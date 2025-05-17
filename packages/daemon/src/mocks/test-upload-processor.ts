/**
 * Test Upload Processor
 * 
 * This script tests the upload processor with mock data.
 * It creates a test upload directory, runs the processor, and verifies the results.
 * It uses a fixed test ID to avoid creating multiple test directories.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fork } from 'child_process';

// Import our mocks
import { AzuraCastApiMock } from './AzuraCastApiMock.js';
import { MixcloudApiMock } from './MixcloudApiMock.js';
import { SoundCloudApiMock } from './SoundCloudApiMock.js';

// Use a fixed test ID to avoid creating multiple test directories
const testUploadId = 'test-upload-123';
const uploadsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../uploads');
const testUploadDir = path.join(uploadsDir, testUploadId);

// Clean up existing test directories
function cleanupExistingTestDirectories() {
  // Clean up the fixed test directory if it exists
  if (fs.existsSync(testUploadDir)) {
    process.stdout.write(`Removing existing test directory: ${testUploadDir}\n`);
    fs.rmSync(testUploadDir, { recursive: true, force: true });
  }
  
  // Clean up any songlist files created by previous tests
  const songlistsDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../../../packages/songlists');
  const testDjDir = path.join(songlistsDir, 'Test DJ');
  if (fs.existsSync(testDjDir)) {
    process.stdout.write(`Cleaning up songlist files in: ${testDjDir}\n`);
    const files = fs.readdirSync(testDjDir);
    files.forEach(file => {
      if (file.includes('Test-Mix')) {
        fs.unlinkSync(path.join(testDjDir, file));
        process.stdout.write(`Removed songlist file: ${file}\n`);
      }
    });
    
    // Remove the directory if it's empty
    if (fs.readdirSync(testDjDir).length === 0) {
      fs.rmdirSync(testDjDir);
      process.stdout.write(`Removed empty directory: ${testDjDir}\n`);
    }
  }
}

// Clean up before starting the test
cleanupExistingTestDirectories();

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Create test upload directory
fs.mkdirSync(testUploadDir, { recursive: true });

// Create test files
const testAudioFile = path.join(path.dirname(new URL(import.meta.url).pathname), '../../test-files/test.mp3');
const testSonglistFile = path.join(path.dirname(new URL(import.meta.url).pathname), '../../test-files/test-songlist.txt');

// Copy test files to upload directory
fs.copyFileSync(testAudioFile, path.join(testUploadDir, 'audio.mp3'));
fs.copyFileSync(testSonglistFile, path.join(testUploadDir, 'songlist.txt'));

// Create test metadata
const testMetadata = {
  title: 'Test Upload',
  djName: 'Test DJ',
  description: 'This is a test upload',
  tags: ['test', 'upload', 'processor'],
  userRole: 'Super Administrator' // Set user role to ADMIN to test the full flow
};

// Write metadata to file
fs.writeFileSync(
  path.join(testUploadDir, 'metadata.json'),
  JSON.stringify(testMetadata, null, 2)
);

// Create initial status file
const initialStatus = {
  status: 'pending',
  message: 'Upload ready for processing',
  timestamp: new Date().toISOString()
};

fs.writeFileSync(
  path.join(testUploadDir, 'status.json'),
  JSON.stringify(initialStatus, null, 2)
);

// Log test setup
process.stdout.write(`Test upload directory created: ${testUploadDir}\n`);
process.stdout.write(`Test files copied\n`);
process.stdout.write(`Test metadata created\n`);
process.stdout.write(`Initial status set to pending\n`);

// Run the upload processor
process.stdout.write(`Running upload processor for upload ID: ${testUploadId}\n`);

const processorPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../processors/upload-processor.ts');
const child = fork(processorPath, [testUploadId], {
  stdio: 'pipe'
});

// Capture processor output
let processorOutput = '';
if (child.stdout) {
  child.stdout.on('data', (data) => {
    const output = data.toString();
    processorOutput += output;
    process.stdout.write(`[Processor] ${output}`);
  });
}

if (child.stderr) {
  child.stderr.on('data', (data) => {
    const output = data.toString();
    processorOutput += output;
    process.stderr.write(`[Processor Error] ${output}`);
  });
}

// Handle processor completion
child.on('close', async (code) => {
  process.stdout.write(`Upload processor exited with code ${code || 0}\n`);
  
  // Add a delay to ensure the status file is fully written
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Read final status
  const statusFile = path.join(testUploadDir, 'status.json');
  if (fs.existsSync(statusFile)) {
    const statusContent = fs.readFileSync(statusFile, 'utf8');
    const status = JSON.parse(statusContent);
    
    process.stdout.write(`Final status: ${status.status}\n`);
    process.stdout.write(`Status message: ${status.message}\n`);
    
    if (status.destinations) {
      process.stdout.write('Destination results:\n');
      process.stdout.write(JSON.stringify(status.destinations, null, 2) + '\n');
    }
  } else {
    process.stderr.write('Status file not found\n');
  }
  
  // Check if songlist was stored
  // Note: The songlist is stored in packages/songlists, not packages/daemon/songlists
  const songlistsDir = path.join(__dirname, '../../../../packages/songlists');
  const djDir = path.join(songlistsDir, testMetadata.djName);
  
  if (fs.existsSync(djDir)) {
    const files = fs.readdirSync(djDir);
    if (files.length > 0) {
      process.stdout.write(`Songlist files found: ${files.join(', ')}\n`);
      
      // Add a check to ensure files[0] exists
      if (files[0]) {
        // Read the first songlist file
        const songlistContent = fs.readFileSync(path.join(djDir, files[0]), 'utf8');
        process.stdout.write(`Songlist content: ${songlistContent}\n`);
      } else {
        process.stderr.write('First file in directory is undefined\n');
      }
    } else {
      process.stderr.write('No songlist files found\n');
    }
  } else {
    process.stderr.write(`DJ directory not found: ${djDir}\n`);
  }
  
  // Test complete
  process.stdout.write('Test complete\n');
  
  // Clean up test directory
  fs.rmSync(testUploadDir, { recursive: true, force: true });
  process.stdout.write(`Test upload directory removed: ${testUploadDir}\n`);
  
  // Clean up songlist files
  const songlistsDirPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../../../../packages/songlists');
  const testDjDir = path.join(songlistsDirPath, testMetadata.djName);
  if (fs.existsSync(testDjDir)) {
    process.stdout.write(`Cleaning up songlist files in: ${testDjDir}\n`);
    const files = fs.readdirSync(testDjDir);
    files.forEach(file => {
      if (file.includes('Test-Mix')) {
        fs.unlinkSync(path.join(testDjDir, file));
        process.stdout.write(`Removed songlist file: ${file}\n`);
      }
    });
    
    // Remove the directory if it's empty
    if (fs.readdirSync(testDjDir).length === 0) {
      fs.rmdirSync(testDjDir);
      process.stdout.write(`Removed empty directory: ${testDjDir}\n`);
    }
  }
});
