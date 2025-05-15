/**
 * Authentication Service
 * 
 * This service provides authentication functionality for the application.
 * It uses both mock data and the real AzuraCast API.
 * 
 * Password handling is done using simple XOR obfuscation to avoid plaintext passwords.
 * 
 * After successful authentication, it verifies that the DJ has a valid directory
 * in AzuraCast before allowing uploads.
 */

import { decodePassword } from '../utils/PasswordUtils.js';
import { AzuraCastApi } from '../apis/AzuraCastApi.js';
import { ErrorType, logDetailedError } from '../utils/LoggingUtils.js';

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
  
  private constructor() {}
  
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }
  
  // Mock authentication - will be replaced with real API call later
  public async authenticate(email: string, encodedPassword: string): Promise<AuthResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Decode the password
    const password = decodePassword(encodedPassword);
    
    const user = this.mockUsers.find(u => u.email === email);
    
    if (!user) {
      return {
        success: false,
        error: 'Invalid credentials'
      };
    }
    
    return {
      success: true,
      user,
      token: `mock-token-${user.id}-${Date.now()}`
    };
  }
  
  // Mock token validation - will be replaced with real API call later
  public async validateToken(token: string): Promise<AuthResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Simple validation for mock tokens
    if (!token.startsWith('mock-token-')) {
      return {
        success: false,
        error: 'Invalid token'
      };
    }
    
    // Extract user ID from token
    const parts = token.split('-');
    const userId = parts[2];
    
    const user = this.mockUsers.find(u => u.id === userId);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found'
      };
    }
    
    return {
      success: true,
      user,
      token
    };
  }
  
  // Authenticate with the real AzuraCast API
  public async authenticateWithAzuraCast(email: string, encodedPassword: string): Promise<AuthResponse> {
    // Decode the password
    const password = decodePassword(encodedPassword);
    
    // Create AzuraCast API client
    const api = new AzuraCastApi();
    
    try {
      // Authenticate with AzuraCast
      const authResult = await api.authenticateWithCredentials(email, password);
      
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Authentication failed'
        };
      }
      
      // Map AzuraCast user to our UserProfile format
      const user: UserProfile = {
        id: authResult.user.id.toString(),
        email: authResult.user.email,
        displayName: authResult.user.name,
        role: this.mapAzuraCastRoleToUserRole(authResult.user.roles)
      };
      
      // For DJ users, verify that their directory exists in AzuraCast
      if (user.role === USER_ROLES.DJ) {
        console.log(`Verifying directory for DJ user: ${user.displayName}`);
        const directoryResult = await this.verifyDjDirectory(user.displayName);
        if (!directoryResult.success) {
          return directoryResult;
        }
      } else {
        console.log(`Skipping directory verification for Admin user: ${user.displayName}`);
        // Admin users don't need directory verification
      }
      
      return {
        success: true,
        user,
        token: authResult.apiKey
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // Helper method to map AzuraCast roles to our UserRole type
  private mapAzuraCastRoleToUserRole(azuraCastRoles: any[]): UserRole {
    console.log('User roles from AzuraCast:', azuraCastRoles);
    
    // Check if the user is a Super Administrator
    if (Array.isArray(azuraCastRoles) && azuraCastRoles.some(role => role.name === 'Super Administrator')) {
      console.log('User has Super Administrator role');
      return USER_ROLES.ADMIN;
    }
    
    console.log('User has DJ role');
    return USER_ROLES.DJ;
  }
  
  // Validate token with the real AzuraCast API
  public async validateTokenWithAzuraCast(token: string): Promise<AuthResponse> {
    // Create AzuraCast API client
    const api = new AzuraCastApi();
    
    try {
      // Get user profile with the API key
      const profileResult = await api.getUserProfile(token);
      
      if (!profileResult.success) {
        return {
          success: false,
          error: profileResult.error || 'Invalid token'
        };
      }
      
      // Map AzuraCast user to our UserProfile format
      const user: UserProfile = {
        id: profileResult.user.id.toString(),
        email: profileResult.user.email,
        displayName: profileResult.user.name,
        role: this.mapAzuraCastRoleToUserRole(profileResult.user.roles)
      };
      
      // For DJ users, verify that their directory exists in AzuraCast
      if (user.role === USER_ROLES.DJ) {
        console.log(`Verifying directory for DJ user: ${user.displayName}`);
        const directoryResult = await this.verifyDjDirectory(user.displayName);
        if (!directoryResult.success) {
          return directoryResult;
        }
      } else {
        console.log(`Skipping directory verification for Admin user: ${user.displayName}`);
        // Admin users don't need directory verification
      }
      
      return {
        success: true,
        user,
        token
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Verify that a directory exists for the DJ in AzuraCast
   * 
   * @param djName The DJ's display name
   * @returns AuthResponse with success/error information
   */
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
