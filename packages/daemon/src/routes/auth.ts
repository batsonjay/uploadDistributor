/**
 * Authentication Routes
 * 
 * This file defines the authentication routes for the application.
 * It provides endpoints for email-based authentication, token validation, and user profile retrieval.
 * 
 * The email-based authentication flow:
 * 1. User requests a login link via /request-login
 * 2. System sends a magic link to their email
 * 3. User clicks the link, which contains a token
 * 4. Frontend sends the token to /verify-login
 * 5. System verifies the token and returns a JWT token
 */

import express from 'express';
import { AuthService, USER_ROLES } from '../services/AuthService.js';
import { logParserEvent, ParserLogType } from '../utils/LoggingUtils.js';
import { adminOnly } from '../middleware/roleVerification.js';
import { AzuraCastApi } from '../apis/AzuraCastApi.js';
import cors from 'cors';

const router = express.Router();
const authService = AuthService.getInstance();

// Add CORS middleware specifically for this router
router.use(cors({
  origin: '*', // Allow all origins for now
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

/**
 * Request login link route
 * 
 * Sends a magic link to the user's email if the email exists in AzuraCast
 */
router.post('/request-login', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email is required'
    });
  }
  
  try {
    logParserEvent('AuthRoutes', ParserLogType.INFO, `Login link requested for email: ${email}`);
    const result = await authService.authenticateWithEmail(email);
    
    if (!result.success) {
      logParserEvent('AuthRoutes', ParserLogType.WARNING, `Login link request failed: ${result.error}`);
      return res.status(400).json(result);
    }
    
    logParserEvent('AuthRoutes', ParserLogType.INFO, `Login link sent to ${email}`);
    return res.json({
      success: true,
      message: 'Magic link sent'
    });
  } catch (err) {
    logParserEvent('AuthRoutes', ParserLogType.ERROR, `Error in /request-login:`, err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Verify login token route
 * 
 * Verifies a magic link token and returns a JWT token and user profile on success
 */
router.post('/verify-login', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'Token is required'
    });
  }
  
  try {
    logParserEvent('AuthRoutes', ParserLogType.INFO, `Verifying login token`);
    const result = await authService.verifyMagicLinkToken(token);
    
    if (!result.success) {
      logParserEvent('AuthRoutes', ParserLogType.WARNING, `Token verification failed: ${result.error}`);
      return res.status(400).json(result);
    }
    
    logParserEvent('AuthRoutes', ParserLogType.INFO, `Token verified successfully for user: ${result.user?.displayName}`);
    return res.json(result);
  } catch (err) {
    logParserEvent('AuthRoutes', ParserLogType.ERROR, `Error in /verify-login:`, err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


/**
 * Validate token route
 * 
 * Validates a JWT token and returns the associated user profile
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
    logParserEvent('AuthRoutes', ParserLogType.INFO, `Token validation requested`);
    const result = await authService.validateToken(token);
    
    if (!result.success) {
      logParserEvent('AuthRoutes', ParserLogType.WARNING, `Token validation failed: ${result.error}`);
      return res.status(401).json(result);
    }
    
    logParserEvent('AuthRoutes', ParserLogType.INFO, `Token validated successfully for user: ${result.user?.displayName}`);
    return res.json(result);
  } catch (err) {
    logParserEvent('AuthRoutes', ParserLogType.ERROR, `Error in /validate:`, err);
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
    logParserEvent('AuthRoutes', ParserLogType.INFO, `Profile retrieval requested`);
    const result = await authService.validateToken(token);
    
    if (!result.success) {
      logParserEvent('AuthRoutes', ParserLogType.WARNING, `Profile retrieval failed: ${result.error}`);
      return res.status(401).json(result);
    }
    
    logParserEvent('AuthRoutes', ParserLogType.INFO, `Profile retrieved successfully for user: ${result.user?.displayName}`);
    return res.json({
      success: true,
      user: result.user
    });
  } catch (err) {
    logParserEvent('AuthRoutes', ParserLogType.ERROR, `Error in /profile:`, err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get all DJs endpoint
 * 
 * Returns a list of all users with DJ role from AzuraCast
 * Only accessible to Super Admin users
 */
router.get('/djs', adminOnly, async (req, res) => {
  try {
    // Add a simple log to track if this endpoint is being called multiple times
    logParserEvent('AuthRoutes', ParserLogType.INFO, 'DJ list requested');
    
    // Create AzuraCast API client
    const api = new AzuraCastApi();
    
    // Get all users from AzuraCast
    const users = await api.getAllUsers();
    
    if (!users.success) {
      logParserEvent('AuthRoutes', ParserLogType.WARNING, `Failed to fetch users: ${users.error}`);
      return res.status(400).json(users);
    }
    
    // Filter to only include DJs (non-admin users)
    if (!users.users || !Array.isArray(users.users)) {
      logParserEvent('AuthRoutes', ParserLogType.WARNING, 'No users found or invalid response format');
      return res.status(400).json({
        success: false,
        error: 'No users found or invalid response format'
      });
    }
    
    const djs = users.users.filter(user => {
      const role = authService.mapAzuraCastRoleToUserRole(user.roles);
      return role === USER_ROLES.DJ;
    }).map(user => ({
      id: user.id.toString(),
      email: user.email,
      displayName: user.name
    }));
    return res.json({
      success: true,
      djs
    });
  } catch (err) {
    logParserEvent('AuthRoutes', ParserLogType.ERROR, `Error in /djs:`, err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
