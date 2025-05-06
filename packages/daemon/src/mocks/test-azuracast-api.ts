/**
 * Test script to authenticate with the AzuraCast API and retrieve the DJ name
 * 
 * This script demonstrates how to use the AzuraCast API key to authenticate
 * with the dev/test server and retrieve user information.
 */

import axios from 'axios';

// API key provided by the user
const API_KEY = '452ea24b5bcae87e:3d6677706dd2a0355c6eedd5ed70677b';

// Base URL for the AzuraCast API
const BASE_URL = 'https://radio.balearic-fm.com';

/**
 * Try different API endpoints and authentication methods
 */
async function testApiEndpoints() {
  try {
    console.log('Testing AzuraCast API endpoints...');
    
    // Try different authentication methods and endpoints
    const endpoints = [
      // User-related endpoints
      {
        name: 'API Admin Users',
        url: `${BASE_URL}/api/admin/users`,
        headers: { 'X-API-Key': API_KEY }
      },
      {
        name: 'API Admin Profile',
        url: `${BASE_URL}/api/admin/profile`,
        headers: { 'X-API-Key': API_KEY }
      },
      {
        name: 'API Admin Permissions',
        url: `${BASE_URL}/api/admin/permissions`,
        headers: { 'X-API-Key': API_KEY }
      },
      // Station-related endpoints
      {
        name: 'API Station 2 Profile',
        url: `${BASE_URL}/api/station/2`,
        headers: { 'X-API-Key': API_KEY }
      },
      {
        name: 'API Station 2 Streamers',
        url: `${BASE_URL}/api/station/2/streamers`,
        headers: { 'X-API-Key': API_KEY }
      },
      {
        name: 'API Station 2 DJs',
        url: `${BASE_URL}/api/station/2/djs`,
        headers: { 'X-API-Key': API_KEY }
      }
    ];
    
    // Try each endpoint
    for (const endpoint of endpoints) {
      try {
        console.log(`\nTrying ${endpoint.name}: ${endpoint.url}`);
        console.log('Headers:', endpoint.headers);
        
        const response = await axios.get(endpoint.url, {
          headers: {
            ...endpoint.headers,
            'Accept': 'application/json'
          }
        });
        
        console.log(`Success! Status: ${response.status}`);
        console.log('Response data:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // If this is a successful response with user information, extract the DJ name
        if (response.data && response.data.name) {
          console.log(`\nFound DJ Name: ${response.data.name}`);
        }
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response) {
          console.log(`Failed with status ${error.response.status}`);
          console.log('Error response:', error.response.data);
        } else {
          console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Unexpected error during API testing:');
    console.error(error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Execute the function
testApiEndpoints().then(result => {
  if (!result.success) {
    process.exit(1);
  }
});
