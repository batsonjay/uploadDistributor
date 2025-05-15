/**
 * Role Verification Middleware
 * 
 * This middleware verifies that the user has the required role to access a route.
 * It extracts the token from the Authorization header, validates it, and checks the user's role.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService, UserRole, USER_ROLES } from '../services/AuthService.js';

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
      
      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Authentication token is required'
        });
      }
      
      // Validate token
      const result = await authService.validateToken(token);
      
      if (!result.success || !result.user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token'
        });
      }
      
      // Check if user has required role
      if (!requiredRoles.includes(result.user.role)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `This action requires one of the following roles: ${requiredRoles.join(', ')}`
        });
      }
      
      // Add user to request object for use in route handlers
      (req as any).user = result.user;
      
      // User has required role, proceed to route handler
      next();
    } catch (err) {
      console.error('Role verification error:', err);
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
