/**
 * Authentication Service
 * 
 * This service provides authentication functionality for the application.
 * It currently uses mock data, but will be updated to use the AzuraCast API in the future.
 * 
 * Password handling is done using simple XOR obfuscation to avoid plaintext passwords.
 */

import { decodePassword } from '../utils/PasswordUtils';

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
      email: 'batsonjay@mac.com',
      displayName: 'catalyst',
      role: USER_ROLES.ADMIN
    },
    {
      id: '2',
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
  
  // This method will be used when we switch to real AzuraCast API
  public async authenticateWithAzuraCast(email: string, encodedPassword: string): Promise<AuthResponse> {
    // This will be implemented later with actual API calls
    // For now, just call the mock method
    return this.authenticate(email, encodedPassword);
  }
  
  // This method will be used when we switch to real AzuraCast API
  public async validateTokenWithAzuraCast(token: string): Promise<AuthResponse> {
    // This will be implemented later with actual API calls
    // For now, just call the mock method
    return this.validateToken(token);
  }
}
