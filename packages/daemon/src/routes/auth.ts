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
import { adminOnly } from '../middleware/roleVerification.js';
import { AzuraCastApi } from '../apis/AzuraCastApi.js';
import cors from 'cors';
import { log, logError } from '@uploadDistributor/logging';

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
    log('D:ROUTE ', 'AU:001', `Login link requested for email: ${email}`);
    const result = await authService.authenticateWithEmail(email);
    
    if (!result.success) {
      log('D:ROUTE ', 'AU:002', `Login link request failed: ${result.error}`);
      return res.status(400).json(result);
    }
    
    log('D:ROUTE ', 'AU:003', `Login link sent to ${email}`);
    return res.json({
      success: true,
      message: 'Magic link sent'
    });
  } catch (err) {
    logError('ERROR   ', 'AU:004', `Error in /request-login:`, err);
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
    log('D:ROUTE ', 'AU:005', `Verifying login token`);
    const result = await authService.verifyMagicLinkToken(token);
    
    if (!result.success) {
      log('D:ROUTE ', 'AU:006', `Token verification failed: ${result.error}`);
      return res.status(400).json(result);
    }
    
    log('D:ROUTE ', 'AU:007', `Token verified successfully for user: ${result.user?.displayName}`);
    return res.json(result);
  } catch (err) {
    logError('ERROR   ', 'AU:008', `Error in /verify-login:`, err);
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
    log('D:ROUTE ', 'AU:009', `Token validation requested`);
    const result = await authService.validateToken(token);
    
    if (!result.success) {
      log('D:ROUTE ', 'AU:010', `Token validation failed: ${result.error}`);
      return res.status(401).json(result);
    }
    
    log('D:ROUTE ', 'AU:011', `Token validated successfully for user: ${result.user?.displayName}`);
    return res.json(result);
  } catch (err) {
    logError('ERROR   ', 'AU:012', `Error in /validate:`, err);
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
    log('D:ROUTE ', 'AU:013', `Profile retrieval requested`);
    const result = await authService.validateToken(token);
    
    if (!result.success) {
      log('D:ROUTE ', 'AU:014', `Profile retrieval failed: ${result.error}`);
      return res.status(401).json(result);
    }
    
    log('D:ROUTE ', 'AU:015', `Profile retrieved successfully for user: ${result.user?.displayName}`);
    return res.json({
      success: true,
      user: result.user
    });
  } catch (err) {
    logError('ERROR   ', 'AU:016', `Error in /profile:`, err);
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
    log('D:ROUTE ', 'AU:017', 'DJ list requested');
    
    // Create AzuraCast API client
    const api = new AzuraCastApi();
    
    // Get all users from AzuraCast
    const users = await api.getAllUsers();
    
    if (!users.success) {
      log('D:ROUTE ', 'AU:018', `Failed to fetch users: ${users.error}`);
      return res.status(400).json(users);
    }
    
    // Filter to only include DJs (non-admin users)
    if (!users.users || !Array.isArray(users.users)) {
      log('D:ROUTE ', 'AU:019', 'No users found or invalid response format');
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
    logError('ERROR   ', 'AU:020', `Error in /djs:`, err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;
