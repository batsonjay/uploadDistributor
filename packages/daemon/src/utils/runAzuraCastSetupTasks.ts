/**
 * AzuraCast Setup Tasks
 * 
 * This utility performs one-time setup tasks for AzuraCast integration:
 * - Fetches and logs the podcast ID for the station
 * - Validates playlist availability for known DJ names
 * 
 * Usage:
 * ```
 * import { runAzuraCastSetupTasks } from './utils/runAzuraCastSetupTasks.js';
 * 
 * // Run the setup tasks
 * runAzuraCastSetupTasks();
 * ```
 */

import axios from 'axios';
import { log, logError } from '@uploadDistributor/logging';
import { AzuraCastApi } from '../apis/AzuraCastApi.js';

// Configuration
const STATION_ID = '2'; // Default station ID for Balearic FM

/**
 * Run AzuraCast setup tasks
 * 
 * @param stationId The station ID (defaults to '2' for Balearic FM)
 * @param validateDjs Whether to validate DJ playlists (defaults to true)
 */
export async function runAzuraCastSetupTasks(
  stationId: string = STATION_ID,
  validateDjs: boolean = true
): Promise<void> {
  log('D:SYSTEM', 'AZ:100', '🔍 Running AzuraCast setup tasks...');
  
  try {
    // Create an instance of the AzuraCast API
    const api = new AzuraCastApi();
    
    // Step 1: Fetch and log the podcast ID
    await fetchPodcastId(api, stationId);
    
    // Step 2: Validate playlist availability for known DJ names
    if (validateDjs) {
      await validateDjPlaylists(api, stationId);
    }
    
    log('D:SYSTEM', 'AZ:101', '✅ AzuraCast setup tasks completed successfully');
  } catch (error) {
    logError('ERROR   ', 'AZ:102', `❌ AzuraCast setup tasks failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Fetch and log the podcast ID for the station
 * 
 * @param api The AzuraCast API instance
 * @param stationId The station ID
 */
async function fetchPodcastId(api: AzuraCastApi, stationId: string): Promise<void> {
  log('D:SYSTEM', 'AZ:103', `Fetching podcasts for station ${stationId}...`);
  
  try {
    // Get the super admin API key from the AzuraCast API instance
    // Note: This is a bit of a hack, but it's the easiest way to get the API key
    const superAdminApiKey = (api as any).superAdminApiKey;
    
    if (!superAdminApiKey) {
      throw new Error('Super admin API key not found');
    }
    
    // Fetch podcasts for the station
    const response = await axios.get(
      `${(api as any).baseUrl}/api/station/${stationId}/podcasts`,
      {
        headers: {
          'X-API-Key': superAdminApiKey,
          'Accept': 'application/json'
        }
      }
    );
    
    // Check if the response contains podcasts
    if (response.data && Array.isArray(response.data)) {
      const podcasts = response.data;
      
      if (podcasts.length === 0) {
        log('D:SYSTEM', 'AZ:104', '⚠️ No podcasts found for this station');
      } else {
        // Log each podcast
        podcasts.forEach((podcast: any, index: number) => {
          log('D:SYSTEM', 'AZ:105', `📝 Podcast ${index + 1}:`);
          log('D:SYSTEM', 'AZ:106', `   ID: ${podcast.id}`);
          log('D:SYSTEM', 'AZ:107', `   Title: ${podcast.title}`);
          log('D:SYSTEM', 'AZ:108', `   Description: ${podcast.description || 'N/A'}`);
          log('D:SYSTEM', 'AZ:109', `   Link: ${podcast.link || 'N/A'}`);
        });
        
        // If there's only one podcast, suggest using it
        if (podcasts.length === 1) {
          log('D:SYSTEM', 'AZ:110', `✅ Found 1 podcast. Suggested podcast ID: ${podcasts[0].id}`);
        } else {
          log('D:SYSTEM', 'AZ:111', `⚠️ Found ${podcasts.length} podcasts. Please choose the appropriate one.`);
        }
      }
    } else {
      log('D:SYSTEM', 'AZ:112', '⚠️ Unexpected response format from podcasts endpoint');
    }
  } catch (error) {
    logError('ERROR   ', 'AZ:113', `❌ Failed to fetch podcasts: ${error instanceof Error ? error.message : String(error)}`);
    
    if (axios.isAxiosError(error) && error.response) {
      logError('ERROR   ', 'AZ:114', `Response status: ${error.response.status}`);
      logError('ERROR   ', 'AZ:115', `Response data: ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Validate playlist availability for known DJ names
 * 
 * @param api The AzuraCast API instance
 * @param stationId The station ID
 */
async function validateDjPlaylists(api: AzuraCastApi, stationId: string): Promise<void> {
  log('D:SYSTEM', 'AZ:116', `Validating DJ playlists for station ${stationId}...`);
  
  try {
    // Get the super admin API key from the AzuraCast API instance
    const superAdminApiKey = (api as any).superAdminApiKey;
    
    if (!superAdminApiKey) {
      throw new Error('Super admin API key not found');
    }
    
    // Fetch playlists for the station
    const response = await axios.get(
      `${(api as any).baseUrl}/api/station/${stationId}/playlists`,
      {
        headers: {
          'X-API-Key': superAdminApiKey,
          'Accept': 'application/json'
        }
      }
    );
    
    // Check if the response contains playlists
    if (response.data && Array.isArray(response.data)) {
      const playlists = response.data;
      
      if (playlists.length === 0) {
        log('D:SYSTEM', 'AZ:117', '⚠️ No playlists found for this station');
      } else {
        // Log each playlist
        log('D:SYSTEM', 'AZ:118', `📝 Found ${playlists.length} playlists:`);
        
        playlists.forEach((playlist: any) => {
          log('D:SYSTEM', 'AZ:119', `   ID: ${playlist.id}, Name: ${playlist.name}`);
        });
        
        // Get all users to check for DJ names
        const usersResponse = await api.getAllUsers();
        
        if (usersResponse.success && usersResponse.users) {
          // Filter users with DJ role
          const djs = usersResponse.users.filter((user: any) => {
            return user.roles && (
              user.roles.includes('DJ') || 
              user.roles.includes('Super Administrator')
            );
          });
          
          if (djs.length === 0) {
            log('D:SYSTEM', 'AZ:120', '⚠️ No DJs found among users');
          } else {
            log('D:SYSTEM', 'AZ:121', `📝 Found ${djs.length} DJs:`);
            
            // Check if each DJ has a matching playlist
            djs.forEach((dj: any) => {
              const djName = dj.name;
              const matchingPlaylists = playlists.filter((playlist: any) => {
                return playlist.name.includes(djName);
              });
              
              if (matchingPlaylists.length === 0) {
                log('D:SYSTEM', 'AZ:122', `⚠️ No matching playlist found for DJ: ${djName}`);
              } else {
                log('D:SYSTEM', 'AZ:123', `✅ Found ${matchingPlaylists.length} matching playlist(s) for DJ: ${djName}`);
                matchingPlaylists.forEach((playlist: any) => {
                  log('D:SYSTEM', 'AZ:124', `   ID: ${playlist.id}, Name: ${playlist.name}`);
                });
              }
            });
          }
        } else {
          log('D:SYSTEM', 'AZ:125', '⚠️ Failed to fetch users');
        }
      }
    } else {
      log('D:SYSTEM', 'AZ:126', '⚠️ Unexpected response format from playlists endpoint');
    }
  } catch (error) {
    logError('ERROR   ', 'AZ:127', `❌ Failed to validate DJ playlists: ${error instanceof Error ? error.message : String(error)}`);
    
    if (axios.isAxiosError(error) && error.response) {
      logError('ERROR   ', 'AZ:128', `Response status: ${error.response.status}`);
      logError('ERROR   ', 'AZ:129', `Response data: ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

// If this file is run directly, execute the setup tasks
if (require.main === module) {
  runAzuraCastSetupTasks()
    .then(() => {
      console.log('Setup tasks completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Setup tasks failed:', error);
      process.exit(1);
    });
}
