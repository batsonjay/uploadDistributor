/**
 * Upload Processor
 * 
 * This module is forked by the daemon to process uploads in isolation.
 * It handles the entire upload flow:
 * 1. Reading files from the upload directory
 * 2. Normalizing the songlist
 * 3. Uploading to destination platforms
 * 4. Updating status information
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get upload ID from command line arguments
// The upload ID is the last argument passed to the script
const uploadId = process.argv[process.argv.length - 1];

console.log('Process arguments:', process.argv);
console.log('Using upload ID:', uploadId);

if (!uploadId) {
  console.error('No upload ID provided');
  process.exit(1);
}

// Define paths
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
console.log('Uploads directory:', uploadsDir);
const uploadDir = path.join(uploadsDir, uploadId);
const audioFile = path.join(uploadDir, 'audio.mp3');
const songlistFile = path.join(uploadDir, 'songlist.txt');
const metadataFile = path.join(uploadDir, 'metadata.json');
const statusFile = path.join(uploadDir, 'status.json');

// Check if required files exist
if (!fs.existsSync(uploadDir)) {
  console.error(`Upload directory not found: ${uploadDir}`);
  process.exit(1);
}

if (!fs.existsSync(audioFile)) {
  console.error(`Audio file not found: ${audioFile}`);
  updateStatus('error', 'Audio file not found');
  process.exit(1);
}

if (!fs.existsSync(songlistFile)) {
  console.error(`Songlist file not found: ${songlistFile}`);
  updateStatus('error', 'Songlist file not found');
  process.exit(1);
}

if (!fs.existsSync(metadataFile)) {
  console.error(`Metadata file not found: ${metadataFile}`);
  updateStatus('error', 'Metadata file not found');
  process.exit(1);
}

// Read metadata
let metadata: any;
try {
  const metadataContent = fs.readFileSync(metadataFile, 'utf8');
  metadata = JSON.parse(metadataContent);
} catch (err) {
  console.error('Error reading metadata:', err);
  updateStatus('error', 'Invalid metadata format');
  process.exit(1);
}

// Main processing function
async function processUpload() {
  try {
    // Update status to processing
    updateStatus('processing', 'Upload processing started');
    
    // Log the start of processing
    console.log(`Processing upload ${uploadId}`);
    console.log('Metadata:', metadata);
    
    // Step 1: Normalize songlist (placeholder for now)
    console.log('Normalizing songlist...');
    await simulateProcessing(1000);
    
    // Step 2: Upload to destinations (placeholder for now)
    console.log('Uploading to destinations...');
    await simulateProcessing(2000);
    
    // Update status to completed
    updateStatus('completed', 'Upload processing completed successfully');
    console.log(`Upload ${uploadId} processed successfully`);
    
    // Exit the process
    process.exit(0);
  } catch (err) {
    console.error('Error processing upload:', err);
    updateStatus('error', `Processing error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// Helper function to update status
function updateStatus(status: string, message: string) {
  const statusData = {
    status,
    message,
    timestamp: new Date().toISOString()
  };
  
  fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2));
}

// Helper function to simulate processing time
function simulateProcessing(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Start processing
processUpload();

// Handle unexpected errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  updateStatus('error', `Uncaught exception: ${(err as Error).message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  updateStatus('error', `Unhandled rejection: ${errorMessage}`);
  process.exit(1);
});
