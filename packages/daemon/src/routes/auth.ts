/**
 * Authentication Routes
 * 
 * This file defines the authentication routes for the application.
 * It provides endpoints for login, token validation, and user profile retrieval.
 * 
 * Password handling is done using simple XOR obfuscation to avoid plaintext passwords.
 */

import express from 'express';
import { AuthService } from '../services/AuthService';
import { encodePassword } from '../utils/PasswordUtils';

const router = express.Router();
const authService = AuthService.getInstance();

/**
 * Login route
 * 
 * Authenticates a user with email and password
 * The password should be encoded using the encodePassword function
 * Returns a token and user profile on success
 */
router.post('/login', async (req, res) => {
  const { email, password, encodedPassword } = req.body;
  
  // Handle both encoded and non-encoded passwords for backward compatibility
  let passwordToUse: string;
  
  if (encodedPassword) {
    // If encodedPassword is provided, use it directly
    passwordToUse = encodedPassword;
  } else if (password) {
    // If only password is provided, encode it
    passwordToUse = encodePassword(password);
  } else {
    // If neither is provided, return an error
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }
  
  try {
    const result = await authService.authenticate(email, passwordToUse);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    return res.json(result);
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Validate token route
 * 
 * Validates a token and returns the associated user profile
 */
router.post('/validate', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Token is required'
    });
  }
  
  try {
    const result = await authService.validateToken(token);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    return res.json(result);
  } catch (err) {
    console.error('Token validation error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get user profile route
 * 
 * Retrieves the user profile associated with the provided token
 * Token should be provided in the Authorization header as "Bearer <token>"
 */
router.get('/profile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication token is required'
    });
  }
  
  try {
    const result = await authService.validateToken(token);
    
    if (!result.success) {
      return res.status(401).json(result);
    }
    
    return res.json({
      success: true,
      user: result.user
    });
  } catch (err) {
    console.error('Profile retrieval error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
