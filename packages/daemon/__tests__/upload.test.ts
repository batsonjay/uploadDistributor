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

// Configuration
const DAEMON_URL = 'http://localhost:3001';
const TEST_FILES_DIR = path.join(__dirname, '../test-files');

// Create test files directory if it doesn't exist
if (!fs.existsSync(TEST_FILES_DIR)) {
  fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
}

// Create a dummy MP3 file if it doesn't exist
const testMp3Path = path.join(TEST_FILES_DIR, 'test.mp3');
if (!fs.existsSync(testMp3Path)) {
  // Create a small binary file that looks like an MP3
  const buffer = Buffer.alloc(1024);
  buffer.write('ID3', 0); // ID3 tag header
  fs.writeFileSync(testMp3Path, buffer);
  console.log(`Created test MP3 file: ${testMp3Path}`);
}

// Create a dummy songlist file if it doesn't exist
const testSonglistPath = path.join(TEST_FILES_DIR, 'test-songlist.txt');
if (!fs.existsSync(testSonglistPath)) {
  const songlist = `00:00:00,Artist A,Track One,Label X
00:05:30,Artist B,Track Two,Label Y
00:10:45,Artist C,Track Three,Label Z`;
  fs.writeFileSync(testSonglistPath, songlist);
  console.log(`Created test songlist file: ${testSonglistPath}`);
}

// Fixed test upload ID to reuse the same directory
const TEST_UPLOAD_ID = 'f66ca46e-5282-4795-a825-ef97a0935c34';

// Function to send test upload
async function sendTestUpload() {
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
    
    // Add files
    form.append('audio', fs.createReadStream(testMp3Path));
    form.append('songlist', fs.createReadStream(testSonglistPath));
    
    console.log('Sending upload to daemon...');
    
    // Send request with the fixed upload ID in headers
    const response = await axios.post(`${DAEMON_URL}/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'x-upload-id': TEST_UPLOAD_ID
      },
    });
    
    console.log('Upload response:', response.data);
    
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

// Function to poll upload status
async function pollUploadStatus(uploadId: string) {
  console.log(`Polling status for upload ${uploadId}...`);
  
  let completed = false;
  let attempts = 0;
  
  while (!completed && attempts < 30) {
    try {
      const response = await axios.get(`${DAEMON_URL}/status/${uploadId}`);
      console.log(`Status (${attempts}):`, response.data);
      
      if (['completed', 'error'].includes(response.data.status)) {
        completed = true;
      } else {
        // Wait 1 second before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    } catch (err) {
      console.error('Error polling status:', (err as Error).message);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (!completed) {
    console.log('Polling timed out');
  }
}

// Run the test
sendTestUpload();
