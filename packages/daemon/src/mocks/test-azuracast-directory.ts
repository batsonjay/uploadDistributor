/**
 * Test script to check if a directory exists for a DJ in AzuraCast
 * 
 * This script demonstrates how to use the AzuraCast API to check if a directory
 * exists for a DJ in the station's files.
 */

import { AzuraCastApi } from '../apis/AzuraCastApi.js';
import { logError } from '@uploadDistributor/logging';

// Station ID for the dev/test station
const STATION_ID = '2';

// DJ names to test
const CORRECT_DJ_NAME = 'catalyst'; // Replace with a known DJ name
const INCORRECT_DJ_NAME = 'nonexistent-dj'; // A DJ name that doesn't exist

/**
 * Test the directory check functionality
 */
async function testDirectoryCheck() {
  try {
    console.log('Testing AzuraCast directory check...');
    
    // Create an instance of the AzuraCast API
    const api = new AzuraCastApi();
    
    // Test with the correct DJ name
    console.log(`\nChecking directory for DJ: ${CORRECT_DJ_NAME}`);
    const correctResult = await api.checkDjDirectoryExists(STATION_ID, CORRECT_DJ_NAME);
    
    // Format the output - only show if it exists or not
    if (correctResult.success) {
      console.log(`Directory for DJ "${CORRECT_DJ_NAME}": ${correctResult.exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
    } else {
      console.log(`Error checking directory for DJ "${CORRECT_DJ_NAME}": ${correctResult.error || 'Unknown error'}`);
    }
    
    // Test with an incorrect DJ name
    console.log(`\nChecking directory for DJ: ${INCORRECT_DJ_NAME}`);
    const incorrectResult = await api.checkDjDirectoryExists(STATION_ID, INCORRECT_DJ_NAME);
    
    // Format the output - only show if it exists or not
    if (incorrectResult.success) {
      console.log(`Directory for DJ "${INCORRECT_DJ_NAME}": ${incorrectResult.exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
    } else {
      console.log(`Error checking directory for DJ "${INCORRECT_DJ_NAME}": ${incorrectResult.error || 'Unknown error'}`);
    }
    
    // Log errors to the error log file if needed
    if (!correctResult.success) {
      logError(
        'ERROR   ',
        'TD:001',
        `Directory check for ${CORRECT_DJ_NAME} failed: ${correctResult.error || 'Unknown error'}`,
        { errorType: 'UNKNOWN', stationId: STATION_ID, djName: CORRECT_DJ_NAME }
      );
    }
    
    if (!incorrectResult.success) {
      logError(
        'ERROR   ',
        'TD:002',
        `Directory check for ${INCORRECT_DJ_NAME} failed: ${incorrectResult.error || 'Directory not found'}`,
        { errorType: 'VALIDATION', stationId: STATION_ID, djName: INCORRECT_DJ_NAME }
      );
    }
    
    // Print summary
    console.log('\n--- Summary ---');
    console.log(`Directory for DJ "${CORRECT_DJ_NAME}": ${correctResult.success && correctResult.exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
    console.log(`Directory for DJ "${INCORRECT_DJ_NAME}": ${incorrectResult.success && incorrectResult.exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
    
    return { success: true };
  } catch (error) {
    console.error('Unexpected error during directory check testing:');
    console.error(error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Execute the function
testDirectoryCheck().then(result => {
  if (!result.success) {
    process.exit(1);
  }
});
