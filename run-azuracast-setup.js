/**
 * Run AzuraCast Setup Tasks
 * 
 * This script runs the one-time setup tasks for AzuraCast integration.
 * It fetches and logs the podcast ID for the station and validates
 * playlist availability for known DJ names.
 * 
 * IMPORTANT: This script only performs GET requests and does not modify any data.
 * It is safe to run against the production station (station ID 1).
 * 
 * Usage:
 * ```
 * node run-azuracast-setup.js
 * ```
 */

// Import axios directly
const axios = require('axios');

// Configuration
const STATION_ID = '1'; // Production station ID for Balearic FM
const BASE_URL = 'https://radio.balearic-fm.com';
const SUPER_ADMIN_API_KEY = '452ea24b5bcae87e:3d6677706dd2a0355c6eedd5ed70677b';

/**
 * Run AzuraCast setup tasks
 */
async function runAzuraCastSetupTasks() {
  console.log('🔍 Running AzuraCast setup tasks...');
  
  try {
    // Step 1: Fetch and log the podcast ID
    await fetchPodcastId();
    
    // Step 2: Display all users and their roles
    await displayAllUsers();
    
    // Step 3: Validate playlist availability for known DJ names
    await validateDjPlaylists();
    
    console.log('✅ AzuraCast setup tasks completed successfully');
  } catch (error) {
    console.error(`❌ AzuraCast setup tasks failed: ${error.message}`);
    throw error;
  }
}

/**
 * Display all users and their roles
 */
async function displayAllUsers() {
  console.log('Fetching all users and their roles...');
  
  try {
    const usersResponse = await getAllUsers();
    
    if (usersResponse.success && usersResponse.users) {
      const users = usersResponse.users;
      
      console.log(`📝 Found ${users.length} users:`);
      
      users.forEach((user, index) => {
        console.log(`User ${index + 1}: ID: ${user.id}, Name: ${user.name || 'N/A'}`);
      });
    } else {
      console.log('⚠️ Failed to fetch users');
      if (usersResponse.error) {
        console.log(`   Error: ${usersResponse.error}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error displaying users: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
  }
}

/**
 * Fetch and log the podcast ID for the station
 */
async function fetchPodcastId() {
  console.log(`Fetching podcasts for station ${STATION_ID}...`);
  
  try {
    // Fetch podcasts for the station
    const response = await axios.get(
      `${BASE_URL}/api/station/${STATION_ID}/podcasts`,
      {
        headers: {
          'X-API-Key': SUPER_ADMIN_API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    
    // Check if the response contains podcasts
    if (response.data && Array.isArray(response.data)) {
      const podcasts = response.data;
      
      if (podcasts.length === 0) {
        console.log('⚠️ No podcasts found for this station');
      } else {
        // Log each podcast
        podcasts.forEach((podcast, index) => {
          console.log(`📝 Podcast ${index + 1}:`);
          console.log(`   ID: ${podcast.id}`);
          console.log(`   Title: ${podcast.title}`);
          console.log(`   Description: ${podcast.description || 'N/A'}`);
          console.log(`   Link: ${podcast.link || 'N/A'}`);
        });
        
        // If there's only one podcast, suggest using it
        if (podcasts.length === 1) {
          console.log(`✅ Found 1 podcast. Suggested podcast ID: ${podcasts[0].id}`);
        } else {
          console.log(`⚠️ Found ${podcasts.length} podcasts. Please choose the appropriate one.`);
        }
      }
    } else {
      console.log('⚠️ Unexpected response format from podcasts endpoint');
    }
  } catch (error) {
    console.error(`❌ Failed to fetch podcasts: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Validate playlist availability for known DJ names
 */
async function validateDjPlaylists() {
  console.log(`Validating DJ playlists for station ${STATION_ID}...`);
  
  try {
    // Fetch playlists for the station
    const response = await axios.get(
      `${BASE_URL}/api/station/${STATION_ID}/playlists`,
      {
        headers: {
          'X-API-Key': SUPER_ADMIN_API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    
    // Check if the response contains playlists
    if (response.data && Array.isArray(response.data)) {
      const playlists = response.data;
      
      if (playlists.length === 0) {
        console.log('⚠️ No playlists found for this station');
      } else {
        // Log each playlist
        console.log(`📝 Found ${playlists.length} playlists:`);
        
        playlists.forEach((playlist) => {
          console.log(`   ID: ${playlist.id}, Name: ${playlist.name}`);
        });
        
        // Get all users to check for DJ names
        const usersResponse = await getAllUsers();
        
        if (usersResponse.success && usersResponse.users) {
          // Filter users with DJ role
          const djs = usersResponse.users.filter((user) => {
            if (!user.roles || !Array.isArray(user.roles)) {
              return false;
            }
            
            // Check if any role has name 'DJ' or 'Super Administrator'
            return user.roles.some(role => 
              role && typeof role === 'object' && 
              (role.name === 'DJ' || role.name === 'Super Administrator')
            );
          });
          
          if (djs.length === 0) {
            console.log('⚠️ No DJs found among users');
          } else {
            console.log(`📝 Found ${djs.length} DJs:`);
            
            // Check if each DJ has a matching playlist
            djs.forEach((dj) => {
              const djName = dj.name;
              const matchingPlaylists = playlists.filter((playlist) => {
                // Case-insensitive but stricter matching
                const djNameLower = djName.toLowerCase();
                const playlistNameLower = playlist.name.toLowerCase();
                
                // Exact match
                if (playlistNameLower === djNameLower) {
                  return true;
                }
                
                // For DJ Takafusa, we want to match "DJ Takafusa" exactly
                if (djNameLower === "dj takafusa" && playlistNameLower === "dj takafusa") {
                  return true;
                }
                
                // For GIUGRI.J, we want to match with Giugri.j (case insensitive)
                if (djNameLower === "giugri.j" && playlistNameLower === "giugri.j") {
                  return true;
                }
                
                // For catalyst, we only want to match the exact "catalyst" playlist
                if (djNameLower === "catalyst" && playlistNameLower === "catalyst") {
                  return true;
                }
                
                // For all other cases, require exact match
                return false;
              });
              
              if (matchingPlaylists.length === 0) {
                console.log(`⚠️ No matching playlist found for DJ: ${djName}`);
              } else {
                console.log(`✅ Found ${matchingPlaylists.length} matching playlist(s) for DJ: ${djName}`);
                matchingPlaylists.forEach((playlist) => {
                  console.log(`   ID: ${playlist.id}, Name: ${playlist.name}`);
                });
              }
            });
          }
        } else {
          console.log('⚠️ Failed to fetch users');
        }
      }
    } else {
      console.log('⚠️ Unexpected response format from playlists endpoint');
    }
  } catch (error) {
    console.error(`❌ Failed to validate DJ playlists: ${error.message}`);
    
    if (error.response) {
      console.error(`Response status: ${error.response.status}`);
      console.error(`Response data: ${JSON.stringify(error.response.data)}`);
    }
    
    throw error;
  }
}

/**
 * Get all users from AzuraCast
 */
async function getAllUsers() {
  try {
    // Get all users using the super admin API key
    const response = await axios.get(
      `${BASE_URL}/api/admin/users`,
      {
        headers: {
          'X-API-Key': SUPER_ADMIN_API_KEY,
          'Accept': 'application/json'
        }
      }
    );
    
    return {
      success: true,
      users: response.data
    };
  } catch (error) {
    console.error(`❌ Get all users error: ${error.message}`);
    
    if (error.response) {
      return {
        success: false,
        error: error.response.data.message || 'Failed to get users'
      };
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the setup tasks
runAzuraCastSetupTasks()
  .then(() => {
    console.log('Setup tasks completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Setup tasks failed:', error);
    process.exit(1);
  });
