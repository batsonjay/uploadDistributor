/**
 * AzuraCast API Client
 * 
 * This class provides methods to interact with the AzuraCast API.
 * Implements authentication and file management methods.
 */

import axios from 'axios';
import { ErrorType } from '../utils/LoggingUtils.js';

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
      
      console.log(`Searching for user with email: ${email}`);
      
      // Find the user with the matching email
      if (Array.isArray(response.data)) {
        const user = response.data.find(u => u.email === email);
        
        if (user) {
          console.log(`Found user: ${user.name} (ID: ${user.id})`);
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
      
      console.log(`No user found with email: ${email}`);
      return {
        success: false,
        error: `User with email ${email} not found`
      };
    } catch (error) {
      console.error('Find user error:', error);
      
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
      console.error('Get user profile error:', error);
      
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
      console.log(`Checking if directory exists for DJ "${djName}" in station ${stationId}`);
      
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
          const match = dir.name === djName || dir.path === djName;
          if (match) {
            console.log(`Match found: Directory "${dir.name}" matches DJ name "${djName}"`);
          }
          return match;
        });
        
        if (directoryExists) {
          console.log(`Directory found for DJ "${djName}" in station ${stationId}`);
          return {
            success: true,
            exists: true,
            directories
          };
        }
      } else {
        // Only log if there's an unexpected response format
        console.log('Response format unexpected - unable to check directories');
      }
      
      console.log(`No directory found for DJ "${djName}"`);
      return {
        success: true,
        exists: false,
        rawResponse: response.data
      };
    } catch (error) {
      console.error(`Directory check error for DJ "${djName}":`, error);
      
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
}
