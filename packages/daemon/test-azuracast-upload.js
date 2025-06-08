/**
 * Test script for AzuraCast upload flow
 * 
 * This script tests the AzuraCast upload implementation.
 * API selection (mock vs. real) is configured in AzuraCastService.ts
 * by commenting/uncommenting the appropriate sections.
 */

import { AzuraCastService } from './dist/services/AzuraCastService.js';
import { StatusManager } from './dist/services/StatusManager.js';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.development' });

// Test file ID
const testFileId = 'test-azuracast-' + Date.now();

// Initialize services
const statusManager = new StatusManager(testFileId);
const azuraCastService = new AzuraCastService(statusManager);

// Test metadata
const testMetadata = {
  title: 'Test DJ Set',
  artist: 'catalyst',
  album: '2025-01-04 Broadcast',
  genre: 'Electronic, House'
};

// Test songlist data
const testSonglist = {
  broadcast_data: {
    broadcast_date: '2025-01-04',
    broadcast_time: '20:00:00',
    DJ: 'catalyst',
    setTitle: 'Test DJ Set',
    genre: ['Electronic', 'House'],
    description: 'Test upload for AzuraCast integration',
    artwork: 'artwork.jpg'
  },
  track_list: [
    {
      title: 'Test Track 1',
      artist: 'Test Artist 1'
    },
    {
      title: 'Test Track 2', 
      artist: 'Test Artist 2'
    }
  ],
  version: '1.0'
};

async function testAzuraCastUpload() {
  console.log('🧪 Testing AzuraCast Upload Flow (Phase 1)');
  console.log('==========================================');
  console.log('Note: API selection is configured in AzuraCastService.ts');
  console.log('');

  try {
    // Test 1: Create metadata from songlist
    console.log('📝 Test 1: Creating metadata from songlist...');
    const metadata = azuraCastService.createMetadataFromSonglist(testSonglist);
    console.log('✅ Metadata created:', JSON.stringify(metadata, null, 2));
    console.log('');

    // Test 2: Test upload with sample file
    console.log('📤 Test 2: Testing upload flow...');
    const sampleFile = path.join(process.cwd(), 'test-files', 'sample-mp3.mp3');
    
    // Check if sample file exists
    if (!fs.existsSync(sampleFile)) {
      console.log('⚠️  Sample MP3 file not found, creating a dummy file for testing...');
      // Create a dummy file for testing
      const dummyFile = path.join(process.cwd(), 'test-dummy.mp3');
      fs.writeFileSync(dummyFile, 'dummy mp3 content for testing');
      
      console.log('🎵 Starting upload test with dummy file...');
      const uploadResult = await azuraCastService.uploadFile(dummyFile, metadata, testSonglist);
      
      // Clean up dummy file
      fs.unlinkSync(dummyFile);
      
      console.log('📊 Upload result:', JSON.stringify(uploadResult, null, 2));
      
      if (uploadResult.success) {
        console.log('✅ Upload test completed successfully!');
        console.log(`   File ID: ${uploadResult.id}`);
        console.log(`   Path: ${uploadResult.path}`);
      } else {
        console.log('❌ Upload test failed:', uploadResult.error);
      }
    } else {
      console.log('🎵 Starting upload test with sample file...');
      const uploadResult = await azuraCastService.uploadFile(sampleFile, metadata, testSonglist);
      
      console.log('📊 Upload result:', JSON.stringify(uploadResult, null, 2));
      
      if (uploadResult.success) {
        console.log('✅ Upload test completed successfully!');
        console.log(`   File ID: ${uploadResult.id}`);
        console.log(`   Path: ${uploadResult.path}`);
      } else {
        console.log('❌ Upload test failed:', uploadResult.error);
      }
    }

    console.log('');
    console.log('🎉 All tests completed!');
    
  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testAzuraCastUpload().then(() => {
  console.log('');
  console.log('🏁 Test script finished');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
