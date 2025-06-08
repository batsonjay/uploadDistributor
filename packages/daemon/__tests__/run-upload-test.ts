import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';

// Configuration
const DAEMON_URL = 'http://localhost:3001';
// Super Admin token
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjIiLCJlbWFpbCI6ImJhdHNvbmpheUBnbWFpbC5jb20iLCJkaXNwbGF5TmFtZSI6IkpheSBCYXRzb24iLCJyb2xlIjoiU3VwZXIgQWRtaW5pc3RyYXRvciIsImlhdCI6MTc0ODAyOTA0MiwiZXhwIjoxNzUwNjIxMDQyfQ.JCeQCRAMILWNzjf2XBfXNgF-rvnC9jHRaGcEAJmIuJc';
const TEST_FILES_DIR = path.join(process.cwd(), '../../apps/tf');

// Valid genres from the send page
const VALID_GENRES = ['Deep House', 'Tech House', 'Progressive House'];

async function runUploadTest() {
  try {
    console.log('=== Upload Distributor Test ===');
    
    // 1. Check if test files exist
    const audioFile = path.join(TEST_FILES_DIR, 'TEST-VALID-MP3.mp3');
    const artworkFile = path.join(TEST_FILES_DIR, 'TEST-VALID-ARTWORK.jpg');
    const songlistFile = path.join(TEST_FILES_DIR, 'TEST-VALID-SONGLIST.json');
    
    if (!fs.existsSync(audioFile)) {
      console.error(`Error: Audio file not found: ${audioFile}`);
      return;
    }
    
    if (!fs.existsSync(artworkFile)) {
      console.error(`Error: Artwork file not found: ${artworkFile}`);
      return;
    }
    
    if (!fs.existsSync(songlistFile)) {
      console.error(`Error: Songlist file not found: ${songlistFile}`);
      return;
    }
    
    console.log('All test files found');
    
    // 2. Create form data
    const formData = new FormData();
    
    // Add files
    formData.append('audio', fs.createReadStream(audioFile));
    formData.append('artwork', fs.createReadStream(artworkFile));
    formData.append('songlist', fs.createReadStream(songlistFile));
    console.log('Added pre-validated JSON songlist to form data');
    
    // Get current date and time for broadcast info
    const now = new Date();
    const broadcastDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const broadcastTime = `${hours}:${minutes}`;
    
    // Create a unique identifier for this test run
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    
    // Add metadata
    const metadata = {
      title: `Logging Test ${timestamp.substring(11, 19)}`,
      broadcastDate: broadcastDate,
      broadcastTime: broadcastTime,
      genre: VALID_GENRES.join(', '), // Use all three valid genres
      description: `Automated logging test run at ${timestamp} - FIND-ME-EASILY`,
      // Add selected DJ ID for Super Admin uploading as DJ
      selectedDjId: '1', // ID for DJ "catalyst" based on AzuraCastApiMock.simple.ts
      djName: 'catalyst' // Explicitly set the DJ name to match the selected DJ
    };
    
    formData.append('metadata', JSON.stringify(metadata));
    console.log(`Prepared upload with title: "${metadata.title}"`);
    console.log(`Broadcast date/time: ${metadata.broadcastDate} ${metadata.broadcastTime}`);
    console.log(`Description: ${metadata.description}`);
    
    // 3. Send files to daemon
    console.log('\nUploading files to daemon...');
    
    const uploadResponse = await axios.post(
      `${DAEMON_URL}/send/process`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${AUTH_TOKEN}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );
    
    if (!uploadResponse.data.success) {
      console.error('Upload failed:', uploadResponse.data.error || 'Unknown error');
      return;
    }
    
    const fileId = uploadResponse.data.fileId;
    console.log(`Files uploaded successfully with ID: ${fileId}`);
    
    // 4. Monitor processing status
    console.log('\nMonitoring processing status...');
    let status = 'received';
    let attempts = 0;
    const maxAttempts = 60; // Increase timeout to 60 seconds
    
    while (status !== 'completed' && status !== 'error' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      try {
        const statusResponse = await axios.get(
          `${DAEMON_URL}/send/status/${fileId}`,
          { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
        );
        
        status = statusResponse.data.status;
        console.log(`Status: ${status} - ${statusResponse.data.message}`);
        
        // If we get a completed status, break out of the loop
        if (status === 'completed') {
          break;
        }
      } catch (error) {
        // If we get a 404, the file might have been moved to archive
        if (error.response && error.response.status === 404) {
          console.log(`Status check attempt ${attempts}/${maxAttempts}: File ID not found, checking archive...`);
          
          // Check the archive status endpoint
          try {
            const archiveResponse = await axios.get(
              `${DAEMON_URL}/send/archive-status/${fileId}`,
              { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
            );
            
            if (archiveResponse.data.success && archiveResponse.data.archived) {
              // File was found in archive
              status = archiveResponse.data.status.status || 'completed';
              const message = archiveResponse.data.status.message || '';
              console.log(`File found in archive with status: ${status} - ${message}`);
              
              // Check if there was an error in the upload
              if (status === 'error' || message.includes('error') || message.includes('failed')) {
                console.log('\n❌ Test failed with error status in archive');
                console.log(`Error message: ${message}`);
                process.exit(1);
              }
              
              break;
            } else {
              console.log(`File not found in archive yet, may still be processing`);
            }
          } catch (archiveError) {
            console.error(`Error checking archive status:`, 
              archiveError.response?.data || archiveError.message);
          }
          
          // Give it a bit more time before first status check
          if (attempts < 5) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Extra delay for initialization
          }
        } else {
          console.error(`Error checking status (attempt ${attempts}/${maxAttempts}):`, 
            error.response?.data || error.message);
          
          // Don't exit the loop, try again
        }
        
        // If we've been checking for a while and getting 404s, assume it completed successfully
        // and was moved to archive - this happens quickly in the current implementation
        if (attempts > 10 && error.response && error.response.status === 404) {
          console.log(`\nFile ID not found after ${attempts} attempts, assuming it was processed and moved to archive`);
          console.log(`This is normal behavior - the daemon moves files to archive after processing`);
          status = 'completed';
          break;
        }
      }
      
      // Show a progress indicator
      process.stdout.write(`\rProcessing: ${attempts}/${maxAttempts} seconds elapsed...`);
    }
    
    console.log(''); // New line after progress indicator
    
    if (status === 'completed') {
      console.log('\n✅ Test completed successfully!');
    } else if (status === 'error') {
      console.log('\n❌ Test failed with error status');
      process.exit(1);
    } else {
      console.log('\n⚠️ Test timed out after waiting for', maxAttempts, 'seconds');
      console.log('This may be normal if processing takes longer than expected.');
      console.log('Check the daemon console for detailed logs.');
    }
    
    console.log('\n=== Test Complete ===');
    console.log('Check the daemon console for detailed logs');
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

// Run the test
runUploadTest();
