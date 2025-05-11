/**
 * Test Send Script Using Shared Module
 * 
 * This script demonstrates how to use the shared send module
 * to send files to the daemon. This approach can be used by
 * both the web client and macOS client.
 */

import * as fs from 'fs';
import * as path from 'path';
// Import directly from the source files instead of the built package
import { 
  sendFiles, 
  SendMetadata, 
  SendFiles, 
  SendCallbacks, 
  SendOptions 
} from '../../shared/src/send';
import { AuthService, USER_ROLES } from '../src/services/AuthService';

// Get authentication token for testing
async function getAuthToken(email: string = 'batsonjay@mac.com'): Promise<string> {
  const authService = AuthService.getInstance();
  // Use a simple encoded password for testing
  const encodedPassword = 'test-password-encoded';
  const result = await authService.authenticate(email, encodedPassword);
  
  if (!result.success || !result.token) {
    throw new Error('Failed to get auth token for testing');
  }
  
  return result.token;
}

// Configuration
const DAEMON_URL = 'http://localhost:3001';
const TEST_FILES_DIR = path.join(__dirname, '../test-files');

// Paths to static test files
const testMp3Path = path.join(TEST_FILES_DIR, 'sample-mp3.mp3');
const testSonglistPath = path.join(TEST_FILES_DIR, 'sample-songlist.txt');
const testArtworkPath = path.join(TEST_FILES_DIR, 'sample-artwork.jpg');

// Verify that the test files exist
if (!fs.existsSync(testMp3Path)) {
  throw new Error(`Test MP3 file not found: ${testMp3Path}`);
}

if (!fs.existsSync(testSonglistPath)) {
  throw new Error(`Test songlist file not found: ${testSonglistPath}`);
}

// Create a sample artwork file if it doesn't exist
if (!fs.existsSync(testArtworkPath)) {
  console.log(`Test artwork file not found, creating a sample one at: ${testArtworkPath}`);
  // Copy the MP3 file to use as a placeholder for the artwork
  // In a real scenario, this would be an actual image file
  fs.copyFileSync(testMp3Path, testArtworkPath);
}

console.log(`Using test MP3 file: ${testMp3Path}`);
console.log(`Using test songlist file: ${testSonglistPath}`);
console.log(`Using test artwork file: ${testArtworkPath}`);

// Fixed test file ID to reuse the same directory
const TEST_FILE_ID = 'f66ca46e-5282-4795-a825-ef97a0935c34';

/**
 * Main test function using the shared send module
 */
async function runTest(userRole: string = USER_ROLES.ADMIN) {
  try {
    console.log('Starting send test using shared module...');
    
    // Prepare metadata
    const metadata: SendMetadata = {
      userId: 'test-user',
      title: 'Test Upload',
      djName: 'Test DJ',
      azcFolder: 'test-folder',
      azcPlaylist: 'test-playlist'
    };
    
    // Prepare files
    const files: SendFiles = {
      audioFile: fs.createReadStream(testMp3Path),
      songlistFile: fs.createReadStream(testSonglistPath),
      artworkFile: fs.createReadStream(testArtworkPath)
    };
    
    // Prepare callbacks
    const callbacks: SendCallbacks = {
      onProgress: (percent) => {
        console.log(`Send progress: ${percent}%`);
      },
      onStatusChange: (status, details) => {
        console.log(`Status changed to: ${status}`);
        console.log('Status details:', details);
      },
      onComplete: (result) => {
        console.log('File processing completed with result:', result);
        
        // Verify we saw the expected status flow
        if (result.statusTransitions) {
          const expectedFlow = ['received', 'processing', 'completed'];
          const missingStatuses = expectedFlow.filter(
            status => !result.statusTransitions.includes(status)
          );
          
          if (missingStatuses.length > 0) {
            console.warn(`Warning: Did not observe these expected statuses: ${missingStatuses.join(', ')}`);
          } else {
            console.log('✅ Observed all expected status transitions');
          }
        }
      },
      onError: (error) => {
        console.error('Send error:', error.message);
      }
    };
    
    // Get auth token
    const email = userRole === USER_ROLES.ADMIN ? 'batsonjay@mac.com' : 'miker@mrobs.co.uk';
    const token = await getAuthToken(email);
    
    // Prepare options
    const options: SendOptions = {
      apiUrl: DAEMON_URL,
      fileId: TEST_FILE_ID,
      token: token,
      pollingInterval: 1000,
      maxPollingAttempts: 30
    };
    
    // Start sending the files
    console.log('Sending files to daemon...');
    const result = await sendFiles(metadata, files, callbacks, options);
    
    console.log('Initial send response:', result);
    
    // Verify the response contains the expected 'received' status
    if (result.status !== 'received') {
      console.warn(`Warning: Expected status 'received' but got '${result.status}'`);
    } else {
      console.log('✅ Files successfully received and validated by daemon');
    }
    
    // The shared module will handle polling in the background
    console.log('Waiting for file processing to complete (polling handled by shared module)...');
    
  } catch (error) {
    console.error('Test failed:', (error as Error).message);
  }
}

// Run the test with Admin role
runTest(USER_ROLES.ADMIN);
