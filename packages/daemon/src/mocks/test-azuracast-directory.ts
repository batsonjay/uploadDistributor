/**
 * Test script to check if a directory exists for a DJ in AzuraCast
 * 
 * This script demonstrates how to use the AzuraCast API to check if a directory
 * exists for a DJ in the station's files.
 */

import { AzuraCastApi } from '../apis/AzuraCastApi';
import { logDetailedError, ErrorType } from '../utils/LoggingUtils';

// Station ID for the dev/test station
const STATION_ID = '2';

// DJ names to test
const CORRECT_DJ_NAME = 'catalyst'; // Replace with a known DJ name
const INCORRECT_DJ_NAME = 'nonexistent-dj'; // A DJ name that doesn't exist

/**
 * Interface for AzuraCast file data
 */
interface AzuraCastFile {
  id: number;
  path: string;
  title: string;
  artist: string;
  album: string;
  [key: string]: any; // Allow for other properties
}

/**
 * Filter file data to only include relevant fields
 */
function filterFileData(files: AzuraCastFile[], limit: number = 5) {
  // Only show a limited number of files
  const limitedFiles = files.slice(0, limit);
  
  // Only include relevant fields
  return limitedFiles.map((file: AzuraCastFile) => ({
    id: file.id,
    path: file.path,
    title: file.title,
    artist: file.artist,
    album: file.album
  }));
}

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
    
    // Filter and format the output
    if (correctResult.success && correctResult.exists && correctResult.files) {
      const fileCount = correctResult.files.length;
      const filteredFiles = filterFileData(correctResult.files);
      
      console.log(`Directory exists for DJ "${CORRECT_DJ_NAME}"`);
      console.log(`Found ${fileCount} files. Showing first ${filteredFiles.length}:`);
      console.log(JSON.stringify(filteredFiles, null, 2));
      
      // Extract path patterns to understand the structure
      const pathPatterns = new Set(correctResult.files.map((file: AzuraCastFile) => file.path));
      console.log('\nPath patterns found:');
      console.log(Array.from(pathPatterns).slice(0, 5));
    } else {
      console.log('Result:', correctResult);
    }
    
    // Test with an incorrect DJ name
    console.log(`\nChecking directory for DJ: ${INCORRECT_DJ_NAME}`);
    const incorrectResult = await api.checkDjDirectoryExists(STATION_ID, INCORRECT_DJ_NAME);
    console.log('Result:', incorrectResult);
    
    // Log errors to the error log file if needed
    if (!correctResult.success) {
      logDetailedError(
        'azuracast',
        `Directory check for ${CORRECT_DJ_NAME}`,
        ErrorType.UNKNOWN,
        correctResult.error || 'Unknown error',
        { stationId: STATION_ID, djName: CORRECT_DJ_NAME },
        1
      );
    }
    
    if (!incorrectResult.success) {
      logDetailedError(
        'azuracast',
        `Directory check for ${INCORRECT_DJ_NAME}`,
        ErrorType.VALIDATION,
        incorrectResult.error || 'Directory not found',
        { stationId: STATION_ID, djName: INCORRECT_DJ_NAME },
        1
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
