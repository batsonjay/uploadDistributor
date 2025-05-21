/**
 * Email Service
 * 
 * This service provides email-based authentication functionality.
 * It handles sending magic link emails and verifying tokens.
 * 
 * The magic link flow:
 * 1. User requests a login link
 * 2. System generates a token and sends a magic link to their email
 * 3. User clicks the link to authenticate
 * 4. System verifies the token and logs the user in
 */

import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { logParserEvent, ParserLogType } from '../utils/LoggingUtils.js';

interface TokenData {
  email: string;
  expires: number;
}

export default class EmailService {
  private static instance: EmailService;
  private tokens: Map<string, TokenData>;
  private transporter: nodemailer.Transporter;
  
  private constructor() {
    this.tokens = new Map();
    
    // Create a nodemailer transporter
    // For development, we'll use a test account
    // In production, this should be configured with real SMTP settings
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ethereal.email',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'test@example.com',
        pass: process.env.SMTP_PASS || 'password'
      }
    });
  }
  
  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }
  
  /**
   * Send a magic link email to the user
   * 
   * @param email The email address to send the link to
   * @returns Promise<boolean> Whether the email was sent successfully
   */
  public async sendMagicLinkEmail(email: string): Promise<boolean> {
    try {
      // Generate a token
      const token = this.generateToken(email);
      
      // Create the magic link URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const magicLink = `${baseUrl}/auth/verify?token=${token}`;
      
      // For testing purposes, just log the magic link and return success
      // This bypasses the actual email sending which requires proper SMTP configuration
      console.log('===============================================');
      console.log(`MAGIC LINK FOR ${email}:`);
      console.log(magicLink);
      console.log('Copy and paste this link in your browser to log in');
      console.log('===============================================');
      
      logParserEvent('EmailService', ParserLogType.INFO, `Generated magic link for ${email}: ${magicLink}`);
      
      // Skip actual email sending for testing
      /*
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Upload Distributor" <noreply@balearic-fm.com>',
        to: email,
        subject: 'Your Login Link for Upload Distributor',
        text: `
Hello,

You requested a login link for Upload Distributor.

Click the link below to log in:
${magicLink}

This link will expire in 15 minutes.

If you didn't request this link, you can safely ignore this email.

Regards,
The Upload Distributor Team
        `,
        html: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Login to Upload Distributor</h2>
  <p>You requested a login link for Upload Distributor.</p>
  <p>Click the button below to log in:</p>
  <p style="text-align: center; margin: 30px 0;">
    <a href="${magicLink}" style="background-color: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
      Log In
    </a>
  </p>
  <p style="font-size: 14px; color: #666;">This link will expire in 15 minutes.</p>
  <p style="font-size: 14px; color: #666;">If you didn't request this link, you can safely ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
  <p style="font-size: 12px; color: #999;">
    Regards,<br>
    The Upload Distributor Team
  </p>
</div>
        `
      });
      
      logParserEvent('EmailService', ParserLogType.INFO, `Email sent to ${email}: ${info.messageId}`);
      */
      
      // Return success since we're bypassing actual email sending
      return true;
    } catch (error) {
      logParserEvent('EmailService', ParserLogType.ERROR, `Failed to send email to ${email}:`, error);
      return false;
    }
  }
  
  /**
   * Generate a token for email-based authentication
   * 
   * @param email The email address to generate a token for
   * @returns string The generated token
   */
  private generateToken(email: string): string {
    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store the token with the email and expiration time
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes
    this.tokens.set(token, { email, expires });
    
    return token;
  }
  
  /**
   * Verify a token and return the associated email
   * 
   * @param token The token to verify
   * @returns Object with valid flag and email if valid
   */
  public verifyToken(token: string): { valid: boolean; email?: string } {
    // Check if the token exists
    if (!this.tokens.has(token)) {
      logParserEvent('EmailService', ParserLogType.WARNING, `Token not found: ${token}`);
      return { valid: false };
    }
    
    // Get the token data
    const tokenData = this.tokens.get(token)!;
    
    // Check if the token has expired
    if (Date.now() > tokenData.expires) {
      logParserEvent('EmailService', ParserLogType.WARNING, `Token expired: ${token}`);
      this.tokens.delete(token); // Clean up expired token
      return { valid: false };
    }
    
    // Token is valid, delete it to prevent reuse
    this.tokens.delete(token);
    
    logParserEvent('EmailService', ParserLogType.INFO, `Token verified for ${tokenData.email}`);
    return { valid: true, email: tokenData.email };
  }
  
  /**
   * Clean up expired tokens
   */
  public cleanupExpiredTokens(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    // Iterate through all tokens and remove expired ones
    for (const [token, data] of this.tokens.entries()) {
      if (now > data.expires) {
        this.tokens.delete(token);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logParserEvent('EmailService', ParserLogType.INFO, `Cleaned up ${expiredCount} expired tokens`);
    }
  }
}
