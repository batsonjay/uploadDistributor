/**
 * Role Verification Middleware
 * 
 * This middleware verifies that the user has the required role to access a route.
 * It extracts the token from the Authorization header, validates it, and checks the user's role.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService, UserRole, USER_ROLES } from '../services/AuthService.js';
import { log, logError } from '@uploadDistributor/logging';

const authService = AuthService.getInstance();

/**
 * Middleware to verify user role
 * @param requiredRoles Array of roles that are allowed to access the route
 * @returns Express middleware function
 */
export const verifyRole = (requiredRoles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const token = req.headers.authorization?.split(' ')[1];
      
      log('D:AUTHDB', 'RV:001', `Verifying token for request to ${req.originalUrl}`);
      
      if (!token) {
        log('D:AUTH  ', 'RV:002', `Missing authentication token for request to ${req.originalUrl}`);
        return res.status(401).json({
          success: false,
          error: 'Authentication token is required'
        });
      }
      
      // Validate token
      const result = await authService.validateToken(token);
      
      if (!result.success || !result.user) {
        log('D:AUTH  ', 'RV:003', `Invalid or expired token for request to ${req.originalUrl}`);
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
      
      // Check if user has required role
      const hasRequiredRole = requiredRoles.includes(result.user.role);
      
      log('D:AUTH  ', 'RV:004', `User ${result.user.displayName} has role ${result.user.role}, required roles: ${requiredRoles.join(', ')}`);
      
      if (!hasRequiredRole) {
        log('D:AUTH  ', 'RV:005', `Insufficient permissions for user ${result.user.displayName} with role ${result.user.role}`);
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `This action requires one of the following roles: ${requiredRoles.join(', ')}`
        });
      }
      
      // Add user to request object for use in route handlers
      (req as any).user = result.user;
      
      log('D:AUTH  ', 'RV:006', `Authentication successful for user ${result.user.displayName}`);
      
      // User has required role, proceed to route handler
      next();
    } catch (err) {
      logError('ERROR   ', 'RV:007', 'Role verification error:', err);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  };
};

// Convenience middleware for common role combinations
export const adminOnly = verifyRole([USER_ROLES.ADMIN]);
export const anyAuthenticated = verifyRole([USER_ROLES.ADMIN, USER_ROLES.DJ]);

// Add debug logging to help diagnose issues
log('D:AUTH  ', 'RV:008', 'Role verification middleware loaded');
log('D:AUTHDB', 'RV:009', `Admin role: ${USER_ROLES.ADMIN}`);
log('D:AUTHDB', 'RV:010', `DJ role: ${USER_ROLES.DJ}`);
