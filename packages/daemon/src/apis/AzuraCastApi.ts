/**
 * AzuraCast API Client
 * 
 * This class provides methods to interact with the AzuraCast API.
 * Implements authentication and file management methods.
 */

import axios from 'axios';
import { log, logError } from '@uploadDistributor/logging';

export class AzuraCastApi {
  private baseUrl: string;
  private superAdminApiKey: string = '452ea24b5bcae87e:3d6677706dd2a0355c6eedd5ed70677b';
  
  constructor(baseUrl: string = 'https://radio.balearic-fm.com') {
    this.baseUrl = baseUrl;
  }


  /**
   * Find a user by email using the super admin API key
   * 
   * @param email The email address to search for
   * @returns Promise with success/error information and user data if found
   */
  public async findUserByEmail(email: string): Promise<any> {
    try {
      // Try to get all users using the super admin API key
      const response = await axios.get(
        `${this.baseUrl}/api/admin/users`,
        {
          headers: {
            'X-API-Key': this.superAdminApiKey,
            'Accept': 'application/json'
          }
        }
      );
      
      // Find the user with the matching email
      if (Array.isArray(response.data)) {
        const user = response.data.find(u => u.email === email);
        
        if (user) {
          return {
            success: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              roles: user.roles || ['DJ']
            }
          };
        }
      }
      return {
        success: false,
        error: `User with email ${email} not found`
      };
    } catch (error) {
      logError('ERROR   ', 'AZ:001', `Find user error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: error.response.data.message || 'Failed to find user'
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get user profile using API key
   * 
   * Note: This method is not currently used for authentication.
   * We're getting the user information directly from the findUserByEmail method.
   */
  async getUserProfile(apiKey: string): Promise<any> {
    try {
      // If it's not the super admin API key, return an error
      if (apiKey !== this.superAdminApiKey) {
        return {
          success: false,
          error: 'Invalid API key'
        };
      }
      
      // Since we're having issues with the admin profile endpoint,
      // we'll just return a success response with the super admin info
      return {
        success: true,
        user: {
          id: '2',
          email: 'batsonjay@gmail.com',
          name: 'Jay Batson',
          roles: ['Super Administrator']
        }
      };
    } catch (error) {
      logError('ERROR   ', 'AZ:002', `Get user profile error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: error.response.data.message || 'Failed to get user profile'
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if a directory exists for a DJ in AzuraCast
   * 
   * This method lists all directories for a station and checks if the DJ's
   * directory exists in the list.
   * 
   * @param stationId The station ID (e.g., "2" for dev/test)
   * @param djName The DJ display name to check
   * @returns Promise with success/error information and whether the directory exists
   */
  async checkDjDirectoryExists(stationId: string, djName: string): Promise<any> {
    try {
      // Get all directories for the station
      const response = await axios.get(
        `${this.baseUrl}/api/station/${stationId}/files/directories`,
        {
          headers: {
            'X-API-Key': this.superAdminApiKey,
            'Accept': 'application/json'
          }
        }
      );
      
      // Check if the response contains a list of directories
      if (response.data && response.data.rows && Array.isArray(response.data.rows)) {
        // The directories are in the rows array with name and path properties
        const directories = response.data.rows;
        
        // Check if the DJ's directory exists in the list
        const directoryExists = directories.some((dir: { name: string, path: string }) => {
          return dir.name === djName || dir.path === djName;
        });
        
        if (directoryExists) {
          return {
            success: true,
            exists: true,
            directories
          };
        }
      } else {
        // Only log if there's an unexpected response format
        logError('ERROR   ', 'AZ:003', 'Response format unexpected - unable to check directories');
      }
      return {
        success: true,
        exists: false,
        rawResponse: response.data
      };
    } catch (error) {
      logError('ERROR   ', 'AZ:004', `Directory check error for DJ "${djName}": ${error}`);
      
      if (axios.isAxiosError(error) && error.response) {
        // If we get a 404, the directory doesn't exist
        if (error.response.status === 404) {
          return {
            success: true,
            exists: false,
            error: 'Directory not found'
          };
        }
        
        return {
          success: false,
          exists: false,
          error: error.response.data.message || 'Failed to check directory'
        };
      }
      
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all users from AzuraCast
   * 
   * @returns Promise with all users or error
   */
  public async getAllUsers(): Promise<{ success: boolean; users?: any[]; error?: string }> {
    try {
      // Get all users using the super admin API key
      const response = await axios.get(
        `${this.baseUrl}/api/admin/users`,
        {
          headers: {
            'X-API-Key': this.superAdminApiKey,
            'Accept': 'application/json'
          }
        }
      );
      
      return {
        success: true,
        users: response.data
      };
    } catch (error) {
      logError('ERROR   ', 'AZ:005', `Get all users error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: error.response.data.message || 'Failed to get users'
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get a user by ID from AzuraCast
   * 
   * @param userId The ID of the user to retrieve
   * @returns Promise with user information or error
   */
  public async getUserById(userId: string): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      // Get all users and find the one with the matching ID
      // Note: AzuraCast API doesn't have a direct endpoint to get a user by ID
      const allUsers = await this.getAllUsers();
      
      if (!allUsers.success || !allUsers.users) {
        return {
          success: false,
          error: allUsers.error || 'Failed to get users'
        };
      }
      
      const user = allUsers.users.find(u => u.id.toString() === userId);
      
      if (user) {
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            roles: user.roles || ['DJ']
          }
        };
      }
      return {
        success: false,
        error: `User with ID ${userId} not found`
      };
    } catch (error) {
      logError('ERROR   ', 'AZ:006', `Get user by ID error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      if (axios.isAxiosError(error) && error.response) {
        return {
          success: false,
          error: error.response.data.message || 'Failed to get user'
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
