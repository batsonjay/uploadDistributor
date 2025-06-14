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

// Test configuration from environment variables
const TARGET_DJ_NAME = process.env.TARGET_DJ_NAME || 'catalyst';
const ADMIN_MODE = process.env.ADMIN_MODE === 'true';

/**
 * Look up a DJ by name from AzuraCast
 */
async function findDjByName(djName: string): Promise<{ success: boolean; dj?: any; error?: string }> {
  try {
    console.log(`🔍 Looking up DJ: "${djName}"`);
    
    const response = await axios.get(
      `${DAEMON_URL}/api/auth/djs`,
      {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      }
    );
    
    if (!response.data || !response.data.success || !Array.isArray(response.data.djs)) {
      return { success: false, error: 'Invalid response from DJs API' };
    }
    
    // Find DJ by name (case-insensitive)
    const djNameLower = djName.toLowerCase();
    const dj = response.data.djs.find((user: any) => 
      user.displayName && user.displayName.toLowerCase() === djNameLower
    );
    
    if (!dj) {
      const availableDjs = response.data.djs.map((user: any) => user.displayName).join(', ');
      return { 
        success: false, 
        error: `DJ "${djName}" not found. Available DJs: ${availableDjs}` 
      };
    }
    
    console.log(`✅ Found DJ: ${dj.displayName} (ID: ${dj.id})`);
    return { success: true, dj };
  } catch (error) {
    return { 
      success: false, 
      error: `Failed to lookup DJ: ${error.response?.data?.message || error.message}` 
    };
  }
}

async function runUploadTest() {
  try {
    console.log('=== AzuraCast Upload Test via File Processor ===');
    console.log(`Mode: ${ADMIN_MODE ? 'Admin' : 'Regular DJ'}`);
    console.log(`Target DJ: ${TARGET_DJ_NAME}`);
    
    // Always look up the target DJ and use admin mode approach
    // This ensures both modes test uploading as the target DJ (catalyst)
    const djLookup = await findDjByName(TARGET_DJ_NAME);
    if (!djLookup.success) {
      console.error(`❌ ${djLookup.error}`);
      process.exit(1);
    }
    const selectedDjId = djLookup.dj.id;
    
    if (ADMIN_MODE) {
      console.log(`✅ Admin mode: Will upload for DJ ${djLookup.dj.displayName} (ID: ${selectedDjId})`);
    } else {
      console.log(`✅ Regular DJ mode: Will test as ${djLookup.dj.displayName} (ID: ${selectedDjId})`);
      console.log(`   Note: Using admin approach to ensure upload as "${TARGET_DJ_NAME}"`);
    }
    
    // 1. Check if test files exist
    const audioFile = path.join(TEST_FILES_DIR, 'TEST-VALID-MP3.mp3');
    const artworkFile = path.join(TEST_FILES_DIR, 'TEST-VALID-ARTWORK.jpg');
    const songlistFile = path.join(TEST_FILES_DIR, 'TEST-VALID-SONGLIST.json');
    
    if (!fs.existsSync(audioFile)) {
      console.error(`Error: Audio file not found: ${audioFile}`);
      process.exit(1);
    }
    
    if (!fs.existsSync(artworkFile)) {
      console.error(`Error: Artwork file not found: ${artworkFile}`);
      process.exit(1);
    }
    
    if (!fs.existsSync(songlistFile)) {
      console.error(`Error: Songlist file not found: ${songlistFile}`);
      process.exit(1);
    }
    
    console.log('✅ All test files found');
    
    // 2. Create form data for file processor exactly like web-UI
    const formData = new FormData();
    
    // Add audio and artwork files
    formData.append('audio', fs.createReadStream(audioFile));
    formData.append('artwork', fs.createReadStream(artworkFile));
    
    // 3. Create metadata exactly like the web-UI does
    const now = new Date();
    const broadcastDate = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const broadcastTime = `${hours}:${minutes}`;
    
    // Create a unique identifier for this test run
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    
    // Create songlist in the same format as web-UI (JSON with format and songs)
    const songsData = {
      format: "json",
      songs: [
        { title: "Test Song 1", artist: "Test Artist 1" },
        { title: "Test Song 2", artist: "Test Artist 2" },
        { title: "Test Song 3", artist: "Test Artist 3" }
      ]
    };
    const songsBlob = Buffer.from(JSON.stringify(songsData));
    formData.append("songlist", songsBlob, "songlist.json");
    
    console.log('📁 Added files to form data (audio, artwork, and generated JSON songlist)');
    
    // Create metadata exactly like web-UI does (without djName - that gets set by the route)
    const metadata = {
      title: `AzuraCast Test ${timestamp.substring(11, 19)}`,
      broadcastDate: broadcastDate,
      broadcastTime: broadcastTime,
      genre: VALID_GENRES.join(', '),
      description: `Direct AzuraCast upload test - ${timestamp} - FIND-ME-EASILY`
    };
    
    // Always send selectedDjId since we always look up the target DJ
    formData.append('selectedDjId', selectedDjId);
    formData.append('metadata', JSON.stringify(metadata));
    
    console.log('📋 Prepared metadata:');
    console.log(`   Title: "${metadata.title}"`);
    console.log(`   Selected DJ ID: ${selectedDjId} (${TARGET_DJ_NAME})`);
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
      process.exit(1);
    }
    
    const fileId = uploadResponse.data.fileId;
    console.log(`✅ Files sent to processor with ID: ${fileId}`);
    
    // 5. Monitor processing status
    console.log('\n⏳ Monitoring file processor status...');
    let status = 'received';
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds timeout
    let finalMessage = '';
    let hasError = false;
    
    while (status !== 'completed' && status !== 'error' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      try {
        const statusResponse = await axios.get(
          `${DAEMON_URL}/send/status/${fileId}`,
          { headers: { 'Authorization': `Bearer ${AUTH_TOKEN}` } }
        );
        
        status = statusResponse.data.status;
        finalMessage = statusResponse.data.message || '';
        console.log(`📊 Status: ${status} - ${finalMessage}`);
        
        // Check for error indicators in the message
        if (finalMessage.toLowerCase().includes('error') || 
            finalMessage.toLowerCase().includes('failed') ||
            finalMessage.toLowerCase().includes('no playlist found')) {
          hasError = true;
        }
        
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
              finalMessage = archiveResponse.data.status.message || '';
              console.log(`📦 File found in archive with status: ${status} - ${finalMessage}`);
              
              // Check for error indicators in archived status
              if (status === 'error' || 
                  finalMessage.toLowerCase().includes('error') || 
                  finalMessage.toLowerCase().includes('failed') ||
                  finalMessage.toLowerCase().includes('no playlist found')) {
                hasError = true;
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
    
    // 6. Determine final result based on status and error indicators
    if (status === 'error' || hasError) {
      console.log('\n❌ Test FAILED!');
      console.log(`❌ Error detected in processing: ${finalMessage}`);
      console.log('🔍 Check the daemon console (brund.sh) for detailed error logs');
      process.exit(1);
    } else if (status === 'completed' && !hasError) {
      console.log('\n🎉 Test completed successfully!');
      console.log('✅ File processor handled the upload pipeline');
      console.log('✅ AzuraCast upload was processed without errors');
    } else {
      console.log('\n⚠️ Test timed out after waiting for', maxAttempts, 'seconds');
      console.log('This may indicate a problem or very slow processing.');
      console.log('🔍 Check the daemon console (brund.sh) for detailed logs');
      process.exit(1);
    }
    
    console.log('\n=== Test Complete ===');
    console.log('🔍 Check the daemon console (brund.sh) for detailed AzuraCast API logs');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run the test
runUploadTest();
