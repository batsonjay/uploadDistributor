/**
 * Test Upload Script
 * 
 * This script simulates a client uploading files to the daemon.
 * It sends a test MP3 file and songlist to the upload endpoint.
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
// Use require for FormData to avoid TypeScript import issues
const FormData = require('form-data');
import { AuthService, USER_ROLES } from '../src/services/AuthService';

// Configuration
const DAEMON_URL = 'http://localhost:3001';
const TEST_FILES_DIR = path.join(__dirname, '../test-files');

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

// Paths to static test files
const testMp3Path = path.join(TEST_FILES_DIR, 'sample-mp3.mp3');
const testSonglistPath = path.join(TEST_FILES_DIR, 'sample-songlist.txt');

// Verify that the test files exist
if (!fs.existsSync(testMp3Path)) {
  throw new Error(`Test MP3 file not found: ${testMp3Path}`);
}

if (!fs.existsSync(testSonglistPath)) {
  throw new Error(`Test songlist file not found: ${testSonglistPath}`);
}

console.log(`Using test MP3 file: ${testMp3Path}`);
console.log(`Using test songlist file: ${testSonglistPath}`);

// Fixed test upload ID to reuse the same directory
const TEST_UPLOAD_ID = 'f66ca46e-5282-4795-a825-ef97a0935c34';

// Function to send test upload with progress tracking
async function sendTestUpload(userRole: string = USER_ROLES.ADMIN) {
  try {
    console.log('Preparing test upload...');
    
    // Create form data
    const form = new FormData();
    
    // Add metadata
    form.append('userId', 'test-user');
    form.append('title', 'Test Upload');
    form.append('djName', 'Test DJ');
    form.append('azcFolder', 'test-folder');
    form.append('azcPlaylist', 'test-playlist');
    
    // Add files with explicit filename
    form.append('audio', fs.createReadStream(testMp3Path), {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg'
    });
    form.append('songlist', fs.createReadStream(testSonglistPath), {
      filename: 'songlist.txt',
      contentType: 'text/plain'
    });
    
    // Log file sizes to verify they have content
    console.log(`Audio file size: ${fs.statSync(testMp3Path).size} bytes`);
    console.log(`Songlist file size: ${fs.statSync(testSonglistPath).size} bytes`);
    
    console.log('Sending upload to daemon...');
    
    // Get auth token
    const email = userRole === USER_ROLES.ADMIN ? 'batsonjay@mac.com' : 'miker@mrobs.co.uk';
    const token = await getAuthToken(email);
    
    // Configure request with progress tracking
    const config = {
      headers: {
        ...form.getHeaders(),
        'x-upload-id': TEST_UPLOAD_ID,
        'Authorization': `Bearer ${token}`
      },
      onUploadProgress: (progressEvent: any) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        console.log(`Upload progress: ${percentCompleted}%`);
      }
    };
    
    // Send request with progress tracking
    const response = await axios.post(`${DAEMON_URL}/upload`, form, config);
    
    console.log('Upload response:', response.data);
    
    // Verify the response contains the expected 'received' status
    if (response.data.status !== 'received') {
      console.warn(`Warning: Expected status 'received' but got '${response.data.status}'`);
    } else {
      console.log('✅ Files successfully received and validated by daemon');
    }
    
    // Use the fixed test upload ID instead of the generated one
    console.log(`Using fixed test upload ID: ${TEST_UPLOAD_ID}`);
    await pollUploadStatus(TEST_UPLOAD_ID);
  } catch (err) {
    console.error('Error sending test upload:', (err as Error).message);
    if ((err as any).response) {
      console.error('Response data:', (err as any).response.data);
    }
  }
}

// Function to poll upload status with improved status tracking
async function pollUploadStatus(uploadId: string, userRole: string = USER_ROLES.ADMIN) {
  // Get auth token
  const email = userRole === USER_ROLES.ADMIN ? 'batsonjay@mac.com' : 'miker@mrobs.co.uk';
  const token = await getAuthToken(email);
  console.log(`Polling status for upload ${uploadId}...`);
  
  let completed = false;
  let attempts = 0;
  let lastStatus = '';
  let statusTransitions: string[] = [];
  
  while (!completed && attempts < 30) {
    try {
      const response = await axios.get(`${DAEMON_URL}/status/${uploadId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const currentStatus = response.data.status;
      
      // Only log when status changes
      if (currentStatus !== lastStatus) {
        console.log(`Status changed to: ${currentStatus}`);
        console.log(`Status details (${attempts}):`, response.data);
        statusTransitions.push(currentStatus);
        lastStatus = currentStatus;
      } else {
        // Just log a dot to show we're still polling
        process.stdout.write('.');
        if (attempts % 10 === 0) process.stdout.write('\n');
      }
      
      if (['completed', 'error'].includes(currentStatus)) {
        completed = true;
        console.log('\nFinal status:', response.data);
      } else {
        // Wait 1 second before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    } catch (err) {
      console.error('\nError polling status:', (err as Error).message);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (!completed) {
    console.log('\nPolling timed out after 30 attempts');
  }
  
  // Log the status transitions we observed
  console.log('Status transitions:', statusTransitions.join(' → '));
  
  // Verify we saw the expected status flow
  const expectedFlow = ['received', 'processing', 'completed'];
  const missingStatuses = expectedFlow.filter(status => !statusTransitions.includes(status));
  
  if (missingStatuses.length > 0) {
    console.warn(`Warning: Did not observe these expected statuses: ${missingStatuses.join(', ')}`);
  } else {
    console.log('✅ Observed all expected status transitions');
  }
}

// Run the test with Admin role
sendTestUpload(USER_ROLES.ADMIN);
