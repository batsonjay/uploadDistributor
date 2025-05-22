/**
 * Authentication Service
 * 
 * This service provides authentication functionality for the application.
 * It supports both email-based authentication and token validation.
 * 
 * The email-based authentication flow:
 * 1. User enters their email address
 * 2. System sends a magic link to their email
 * 3. User clicks the link to authenticate
 * 4. System verifies the email and retrieves user information from AzuraCast
 * 
 * After successful authentication, it verifies that the DJ has a valid directory
 * in AzuraCast before allowing uploads.
 */

import { decodePassword } from '../utils/PasswordUtils.js';
import { AzuraCastApi } from '../apis/AzuraCastApi.js';
import { ErrorType, logDetailedError, logParserEvent, ParserLogType } from '../utils/LoggingUtils.js';
import EmailService from './EmailService.js';
import jwt from 'jsonwebtoken';

// Define user roles as constants for easy modification
export const USER_ROLES = {
  // TODO: Confirm this is the exact string returned by AzuraCast API when connecting to dev/test server
  ADMIN: 'Super Administrator',
  DJ: 'DJ'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  token?: string;
  error?: string;
}

export class AuthService {
  private static instance: AuthService;
  private jwtSecret: string;
  private mockUsers: UserProfile[] = [
    {
      id: '1',
      email: 'batsonjay@gmail.com',
      displayName: 'Jay Batson',
      role: USER_ROLES.ADMIN
    },
    {
      id: '2',
      email: 'batsonjay@mac.com',
      displayName: 'catalyst',
      role: USER_ROLES.DJ
    },
    {
      id: '3',
      email: 'miker@mrobs.co.uk',
      displayName: 'Chewee',
      role: USER_ROLES.DJ
    }
  ];
  
  private constructor() {
    // Use environment variable for JWT secret or a default for development
    this.jwtSecret = process.env.JWT_SECRET || 'upload-distributor-dev-secret-key';
    
    // Set up a periodic cleanup of expired tokens
    setInterval(() => {
      EmailService.getInstance().cleanupExpiredTokens();
    }, 15 * 60 * 1000); // Run every 15 minutes
  }
  
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  /**
   * Request email-based authentication
   * Sends a magic link to the user's email if the email exists in AzuraCast
   */
  public async authenticateWithEmail(email: string): Promise<AuthResponse> {
    logParserEvent('AuthService', ParserLogType.INFO, `Authentication requested for email: ${email}`);
    
    try {
      // Create AzuraCast API client
      const api = new AzuraCastApi();
      
      // Find user by email in AzuraCast
      const user = await api.findUserByEmail(email);
      
      if (!user) {
        logParserEvent('AuthService', ParserLogType.WARNING, `No such email address found: ${email}`);
        return {
          success: false,
          error: 'No such email address found. Please check your spelling or contact your station administrator.'
        };
      }
      
      // Send magic link email
      const emailService = EmailService.getInstance();
      const sent = await emailService.sendMagicLinkEmail(email);
      
      if (!sent) {
        logParserEvent('AuthService', ParserLogType.ERROR, `Failed to send login email to ${email}`);
        return {
          success: false,
          error: 'Failed to send login email. Please try again or contact your administrator.'
        };
      }
      
      logParserEvent('AuthService', ParserLogType.INFO, `Magic link email sent to ${email}`);
      return {
        success: true
      };
    } catch (error) {
      logParserEvent('AuthService', ParserLogType.ERROR, `Error in authenticateWithEmail:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Verify a magic link token and authenticate the user
   */
  public async verifyMagicLinkToken(token: string): Promise<AuthResponse> {
    logParserEvent('AuthService', ParserLogType.INFO, `Verifying magic link token`);
    
    try {
      // Verify the token
      const emailService = EmailService.getInstance();
      const { valid, email } = emailService.verifyToken(token);
      
      if (!valid || !email) {
        logParserEvent('AuthService', ParserLogType.WARNING, `Invalid or expired token`);
        return {
          success: false,
          error: 'Invalid or expired token. Please request a new login link.'
        };
      }
      
      // Create AzuraCast API client
      const api = new AzuraCastApi();
      
      // Find user by email in AzuraCast
      const userResult = await api.findUserByEmail(email);
      
      if (!userResult || !userResult.success || !userResult.user) {
        logParserEvent('AuthService', ParserLogType.WARNING, `User not found for email: ${email}`);
        return {
          success: false,
          error: 'User not found. Please contact your administrator.'
        };
      }
      
      const apiUser = userResult.user;
      
      // Map AzuraCast user to our UserProfile format
      const userProfile: UserProfile = {
        id: apiUser.id.toString(),
        email: apiUser.email,
        displayName: apiUser.name,
        role: this.mapAzuraCastRoleToUserRole(apiUser.roles)
      };
      
      // For DJ users, verify that their directory exists in AzuraCast
      if (userProfile.role === USER_ROLES.DJ) {
        const directoryResult = await this.verifyDjDirectory(userProfile.displayName);
        if (!directoryResult.success) {
          return directoryResult;
        }
      }
      
      // Generate a JWT token
      const jwtToken = this.generateToken(userProfile);
      
      logParserEvent('AuthService', ParserLogType.INFO, `Magic link token verified successfully for ${email}`);
      return {
        success: true,
        user: userProfile,
        token: jwtToken
      };
    } catch (error) {
      logParserEvent('AuthService', ParserLogType.ERROR, `Error in verifyMagicLinkToken:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Generate a JWT token for the user
   */
  private generateToken(user: UserProfile): string {
    // Create a JWT token with user information
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role
      },
      this.jwtSecret,
      { expiresIn: '30d' } // Server-side expiration (client will handle role-based expiration)
    );
  }
  
  /**
   * Validate a JWT token
   */
  public async validateToken(token: string): Promise<AuthResponse> {
    try {
      // Verify the JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      // Create user profile from decoded token
      const user: UserProfile = {
        id: decoded.id,
        email: decoded.email,
        displayName: decoded.displayName,
        role: decoded.role
      };
      
      // For DJ users, verify that their directory exists in AzuraCast
      if (user.role === USER_ROLES.DJ) {
        const directoryResult = await this.verifyDjDirectory(user.displayName);
        if (!directoryResult.success) {
          return directoryResult;
        }
      }
      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      logParserEvent('AuthService', ParserLogType.ERROR, `Error validating token:`, error);
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }
  }
  
  
  // Helper method to map AzuraCast roles to our UserRole type
  public mapAzuraCastRoleToUserRole(azuraCastRoles: any[]): UserRole {
    if (!azuraCastRoles) {
      return USER_ROLES.DJ;
    }
    
    // Check if the user is a Super Administrator
    if (Array.isArray(azuraCastRoles)) {
      // Handle both formats: array of objects with name property or array of strings
      const isAdmin = azuraCastRoles.some(role => {
        if (typeof role === 'string') {
          return role === 'Super Administrator';
        } else if (role && typeof role === 'object' && 'name' in role) {
          return role.name === 'Super Administrator';
        }
        return false;
      });
      
      if (isAdmin) {
        return USER_ROLES.ADMIN;
      }
    }
    
    return USER_ROLES.DJ;
  }
  
  
  /**
   * Verify that a directory exists for the DJ in AzuraCast
   * 
   * @param djName The DJ's display name
   * @returns AuthResponse with success/error information
   */
  /**
   * Get a user by ID from AzuraCast
   * 
   * @param userId The ID of the user to retrieve
   * @returns Promise with user information or error
   */
  public async getUserById(userId: string): Promise<AuthResponse> {
    try {
      // Create AzuraCast API client
      const api = new AzuraCastApi();
      
      // Get user from AzuraCast
      const userResult = await api.getUserById(userId);
      
      if (!userResult.success || !userResult.user) {
        logParserEvent('AuthService', ParserLogType.WARNING, `User not found with ID: ${userId}`);
        return {
          success: false,
          error: 'User not found'
        };
      }
      
      const apiUser = userResult.user;
      
      // Map AzuraCast user to our UserProfile format
      const userProfile: UserProfile = {
        id: apiUser.id.toString(),
        email: apiUser.email,
        displayName: apiUser.name,
        role: this.mapAzuraCastRoleToUserRole(apiUser.roles)
      };
      return {
        success: true,
        user: userProfile
      };
    } catch (error) {
      logParserEvent('AuthService', ParserLogType.ERROR, `Error in getUserById:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async verifyDjDirectory(djName: string): Promise<AuthResponse> {
    // Create AzuraCast API client
    const api = new AzuraCastApi();
    
    try {
      // Use station ID 2 for dev/test
      const stationId = '2';
      
      // Check if the directory exists
      const directoryResult = await api.checkDjDirectoryExists(stationId, djName);
      
      if (!directoryResult.success) {
        // Log the error
        logDetailedError(
          'azuracast',
          `Directory check for ${djName}`,
          ErrorType.VALIDATION,
          directoryResult.error || 'Failed to check directory',
          { stationId, djName },
          1
        );
        
        return {
          success: false,
          error: 'Media upload folder name mismatch; inform station administrator'
        };
      }
      
      if (!directoryResult.exists) {
        // Log the error
        logDetailedError(
          'azuracast',
          `Directory check for ${djName}`,
          ErrorType.VALIDATION,
          'Directory does not exist',
          { stationId, djName },
          1
        );
        
        return {
          success: false,
          error: 'Media upload folder name mismatch; inform station administrator'
        };
      }
      
      // Directory exists, return success
      return { success: true };
    } catch (error) {
      // Log the error
      logDetailedError(
        'azuracast',
        `Directory check for ${djName}`,
        ErrorType.UNKNOWN,
        error instanceof Error ? error.message : 'Unknown error',
        { djName },
        1
      );
      
      return {
        success: false,
        error: 'Failed to verify upload directory; please try again later'
      };
    }
  }
}
