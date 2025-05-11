/**
 * File Manager Tests
 * 
 * Tests for the FileManager service that handles moving files from temporary
 * UUID directories to organized archive structure.
 */

import * as fs from 'fs';
import * as path from 'path';
import { FileManager } from '../src/services/FileManager';
import { SonglistData } from '../src/storage/SonglistStorage';

// Test constants
const TEST_FILES_DIR = path.join(__dirname, '../test-files');
const TEST_RECEIVED_DIR = path.join(__dirname, '../test-received');
const TEST_ARCHIVE_DIR = path.join(__dirname, '../test-archive');
const TEST_FILE_ID = 'test-file-id-' + Date.now();

// Test files
const testAudioPath = path.join(TEST_FILES_DIR, 'sample-mp3.mp3');
const testSonglistPath = path.join(TEST_FILES_DIR, 'sample-songlist.txt');
const testArtworkPath = path.join(TEST_FILES_DIR, 'sample-artwork.jpg');

// Test songlist data
const testSonglist: SonglistData = {
  broadcast_data: {
    broadcast_date: '2025-05-11',
    broadcast_time: '18:00:00',
    DJ: 'Test DJ',
    setTitle: 'Test Episode Title',
    duration: '01:00:00'
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

// Setup test environment
function setupTestEnvironment() {
  // Create test directories if they don't exist
  if (!fs.existsSync(TEST_RECEIVED_DIR)) {
    fs.mkdirSync(TEST_RECEIVED_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(TEST_ARCHIVE_DIR)) {
    fs.mkdirSync(TEST_ARCHIVE_DIR, { recursive: true });
  }
  
  // Create test file directory
  const testFileDir = path.join(TEST_RECEIVED_DIR, TEST_FILE_ID);
  if (!fs.existsSync(testFileDir)) {
    fs.mkdirSync(testFileDir, { recursive: true });
  }
  
  // Copy test files to test directory
  fs.copyFileSync(testAudioPath, path.join(testFileDir, 'audio.mp3'));
  fs.copyFileSync(testSonglistPath, path.join(testFileDir, 'songlist.txt'));
  fs.copyFileSync(testArtworkPath, path.join(testFileDir, 'artwork.jpg'));
  
  // Create metadata.json
  const metadata = {
    userId: 'test-user',
    title: 'Test Upload',
    djName: 'Test DJ',
    artworkFilename: 'artwork.jpg'
  };
  fs.writeFileSync(
    path.join(testFileDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
  
  // Create status.json
  const status = {
    status: 'completed',
    message: 'Processing completed successfully',
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(testFileDir, 'status.json'),
    JSON.stringify(status, null, 2)
  );
  
  return testFileDir;
}

// Clean up test environment
function cleanupTestEnvironment() {
  // Remove test directories
  if (fs.existsSync(TEST_RECEIVED_DIR)) {
    fs.rmSync(TEST_RECEIVED_DIR, { recursive: true, force: true });
  }
  
  if (fs.existsSync(TEST_ARCHIVE_DIR)) {
    fs.rmSync(TEST_ARCHIVE_DIR, { recursive: true, force: true });
  }
}

// Main test function
async function runTests() {
  console.log('Starting FileManager tests...');
  
  try {
    // Setup test environment
    const testFileDir = setupTestEnvironment();
    console.log(`Test file directory created: ${testFileDir}`);
    
    // Create FileManager with test directories
    const fileManager = new FileManager();
    
    // Override the default directories with test directories
    Object.defineProperty(fileManager, 'receivedFilesDir', {
      value: TEST_RECEIVED_DIR
    });
    
    Object.defineProperty(fileManager, 'archiveDir', {
      value: TEST_ARCHIVE_DIR
    });
    
    // Move files to archive
    console.log('Moving files to archive...');
    const { archivePath, fileMap } = fileManager.moveToArchive(TEST_FILE_ID, testSonglist);
    
    console.log(`Files moved to archive: ${archivePath}`);
    console.log(`File mapping: ${JSON.stringify(fileMap, null, 2)}`);
    
    // Verify archive directory exists
    if (!fs.existsSync(archivePath)) {
      throw new Error(`Archive directory not created: ${archivePath}`);
    }
    
    // Verify files were moved
    const expectedFiles = [
      '2025-05-11_Test_DJ_Test-Episode-Title.mp3',
      '2025-05-11_Test_DJ_Test-Episode-Title.txt',
      '2025-05-11_Test_DJ_Test-Episode-Title.json',
      '2025-05-11_Test_DJ_Test-Episode-Title_status.json',
      '2025-05-11_Test_DJ_Test-Episode-Title.jpg'
    ];
    
    for (const expectedFile of expectedFiles) {
      const filePath = path.join(archivePath, expectedFile);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Expected file not found: ${filePath}`);
      }
      console.log(`✅ Verified file exists: ${expectedFile}`);
    }
    
    // Verify original directory was deleted
    if (fs.existsSync(testFileDir)) {
      throw new Error(`Original directory not deleted: ${testFileDir}`);
    }
    console.log('✅ Original directory was deleted');
    
    console.log('All tests passed! 🎉');
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    // Clean up test environment
    cleanupTestEnvironment();
  }
}

// Run tests
runTests();
