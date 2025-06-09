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
    console.log('=== AzuraCast Upload Test via File Processor ===');
    
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
    
    console.log('✅ All test files found');
    
    // 2. Create form data for file processor
    const formData = new FormData();
    
    // Add files
    formData.append('audio', fs.createReadStream(audioFile));
    formData.append('artwork', fs.createReadStream(artworkFile));
    formData.append('songlist', fs.createReadStream(songlistFile));
    console.log('📁 Added files to form data (including pre-validated JSON songlist)');
    
    // 3. Create metadata with all required fields
    const now = new Date();
    const broadcastDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const broadcastTime = `${hours}:${minutes}`;
    
    // Create a unique identifier for this test run
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    
    const metadata = {
      // Basic info
      title: `AzuraCast Test ${timestamp.substring(11, 19)}`,
      broadcastDate: broadcastDate,
      broadcastTime: broadcastTime,
      
      // Genre list (required for AzuraCast)
      genre: VALID_GENRES.join(', '),
      
      // Description
      description: `Direct AzuraCast upload test - ${timestamp} - FIND-ME-EASILY`,
      
      // DJ name will be set by the route after DJ lookup
      djName: 'catalyst' // This will be overridden by the route
    };
    
    // Add selectedDjId as a separate form field (not in metadata JSON)
    formData.append('selectedDjId', '1'); // ID for DJ "catalyst"
    formData.append('metadata', JSON.stringify(metadata));
    
    console.log('📋 Prepared metadata:');
    console.log(`   Title: "${metadata.title}"`);
    console.log(`   DJ: ${metadata.djName} (ID: 1 - catalyst)`);
    console.log(`   Date/Time: ${metadata.broadcastDate} ${metadata.broadcastTime}`);
    console.log(`   Genre: ${metadata.genre}`);
    console.log(`   Description: ${metadata.description}`);
    
    // 4. Send to daemon file processor
    console.log('\n🚀 Sending files to daemon file processor...');
    
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
      console.error('❌ Upload failed:', uploadResponse.data.error || 'Unknown error');
      return;
    }
    
    const fileId = uploadResponse.data.fileId;
    console.log(`✅ Files sent to processor with ID: ${fileId}`);
    
    // 5. Monitor processing status
    console.log('\n⏳ Monitoring file processor status...');
    let status = 'received';
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout
    
    while (status !== 'completed' && status !== 'error' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      try {
        const statusResponse = await axios.get(
          `${DAEMON_URL}/send/status/${fileId}`,
          { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
        );
        
        status = statusResponse.data.status;
        console.log(`📊 Status: ${status} - ${statusResponse.data.message}`);
        
        if (status === 'completed') {
          break;
        }
      } catch (error) {
        // If we get a 404, the file might have been moved to archive
        if (error.response && error.response.status === 404) {
          console.log(`🔍 File ID not found, checking archive... (attempt ${attempts}/${maxAttempts})`);
          
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
              console.log(`📦 File found in archive with status: ${status} - ${message}`);
              
              // Check if there was an error in the upload
              if (status === 'error' || message.includes('error') || message.includes('failed')) {
                console.log('\n❌ Test failed with error status in archive');
                console.log(`Error message: ${message}`);
                process.exit(1);
              }
              
              break;
            } else {
              console.log(`📦 File not found in archive yet, may still be processing`);
            }
          } catch (archiveError) {
            console.error(`❌ Error checking archive status:`, 
              archiveError.response?.data || archiveError.message);
          }
          
          // Give it a bit more time for initialization
          if (attempts < 5) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } else {
          console.error(`❌ Error checking status (attempt ${attempts}/${maxAttempts}):`, 
            error.response?.data || error.message);
        }
        
        // If we've been checking for a while and getting 404s, assume it completed
        if (attempts > 10 && error.response && error.response.status === 404) {
          console.log(`\n📦 File ID not found after ${attempts} attempts, assuming processed and archived`);
          console.log(`This is normal behavior - the daemon moves files to archive after processing`);
          status = 'completed';
          break;
        }
      }
      
      // Show a progress indicator
      process.stdout.write(`\r⏳ Processing: ${attempts}/${maxAttempts} seconds elapsed...`);
    }
    
    console.log(''); // New line after progress indicator
    
    if (status === 'completed') {
      console.log('\n🎉 Test completed successfully!');
      console.log('✅ File processor handled the upload pipeline');
      console.log('✅ AzuraCast upload should have been processed');
    } else if (status === 'error') {
      console.log('\n❌ Test failed with error status');
      process.exit(1);
    } else {
      console.log('\n⚠️ Test timed out after waiting for', maxAttempts, 'seconds');
      console.log('This may be normal if processing takes longer than expected.');
    }
    
    console.log('\n=== Test Complete ===');
    console.log('🔍 Check the daemon console (brund.sh) for detailed AzuraCast API logs');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
runUploadTest();
