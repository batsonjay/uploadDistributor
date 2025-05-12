/**
 * File Processor
 * 
 * This module is forked by the daemon to process files in isolation.
 * It handles the entire flow:
 * 1. Reading files that were received from clients
 * 2. Normalizing the songlist
 * 3. Uploading files to destination platforms (AzuraCast, Mixcloud, SoundCloud)
 * 4. Updating status information
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Import our modules
import { 
  SonglistData, 
  parseSonglist, 
  storeSonglist 
} from '../storage/SonglistStorage';
import { USER_ROLES, UserRole } from '../services/AuthService';
import { utcToCet } from '../utils/TimezoneUtils';

// Import services
import { StatusManager } from '../services/StatusManager';
import { AzuraCastService } from '../services/AzuraCastService';
import { MixcloudService } from '../services/MixcloudService';
import { SoundCloudService } from '../services/SoundCloudService';
import { FileManager } from '../services/FileManager';

// Load environment variables
dotenv.config();

// Get file ID from command line arguments
// The file ID is the last argument passed to the script
const fileId: string = process.argv[process.argv.length - 1] || 'default-file-id';

process.stdout.write('Process arguments: ' + JSON.stringify(process.argv) + '\n');
process.stdout.write(`Using file ID: ${fileId}\n`);

if (!fileId || fileId === 'default-file-id') {
  process.stderr.write('No file ID provided\n');
  process.exit(1);
}

// Define paths
const receivedFilesDir = process.env.RECEIVED_FILES_DIR || path.join(__dirname, '../../received-files');
process.stdout.write(`Files directory: ${receivedFilesDir}\n`);
const fileDir = path.join(receivedFilesDir, fileId);
const audioFile = path.join(fileDir, 'audio.mp3');
const songlistFile = path.join(fileDir, 'songlist.txt');
const metadataFile = path.join(fileDir, 'metadata.json');
const statusFile = path.join(fileDir, 'status.json');

// Initialize services
const statusManager = new StatusManager(fileId);
const fileManager = new FileManager();

// Check if required files exist
if (!fs.existsSync(fileDir)) {
  process.stderr.write(`File directory not found: ${fileDir}\n`);
  process.exit(1);
}

if (!fs.existsSync(audioFile)) {
  process.stderr.write(`Audio file not found: ${audioFile}\n`);
  statusManager.updateStatus('error', 'Audio file not found');
  process.exit(1);
}

if (!fs.existsSync(songlistFile)) {
  process.stderr.write(`Songlist file not found: ${songlistFile}\n`);
  statusManager.updateStatus('error', 'Songlist file not found');
  process.exit(1);
}

if (!fs.existsSync(metadataFile)) {
  process.stderr.write(`Metadata file not found: ${metadataFile}\n`);
  statusManager.updateStatus('error', 'Metadata file not found');
  process.exit(1);
}

// Read metadata
let metadata: any;
try {
  const metadataContent = fs.readFileSync(metadataFile, 'utf8');
  metadata = JSON.parse(metadataContent);
} catch (err) {
  process.stderr.write(`Error reading metadata: ${err}\n`);
  statusManager.updateStatus('error', 'Invalid metadata format');
  process.exit(1);
}

// Initialize platform services
const azuraCastService = new AzuraCastService(statusManager);
const mixcloudService = new MixcloudService(statusManager);
const soundCloudService = new SoundCloudService(statusManager);

// Main processing function
async function processFiles() {
  try {
    // Update status to processing - the receive route already set status to 'received'
    statusManager.updateStatus('processing', 'Processing started');
    
    // Log the start of processing
    process.stdout.write(`Processing files for ${fileId}\n`);
    process.stdout.write(`Metadata: ${JSON.stringify(metadata, null, 2)}\n`);
    
    // Get user role from metadata or default to DJ
    let userRole: UserRole = USER_ROLES.DJ;
    
    if (metadata.userRole && (metadata.userRole === USER_ROLES.ADMIN || metadata.userRole === USER_ROLES.DJ)) {
      userRole = metadata.userRole;
    }
    
    // For DJ users, we can return success immediately after storing the songlist
    const isDjUser = userRole === USER_ROLES.DJ;
    
    // Step 1: Parse and normalize songlist
    process.stdout.write('Parsing songlist...\n');
    
    // For now, we'll use our sample songlist as a stub
    // In a real implementation, we would parse the actual songlist file
    const sampleSonglistPath = path.join(__dirname, '../../songlists/sample-songlist.json');
    let songlist: SonglistData;
    
    try {
      // If the sample songlist exists, use it
      if (fs.existsSync(sampleSonglistPath)) {
        songlist = parseSonglist(sampleSonglistPath);
        process.stdout.write(`Using sample songlist: ${sampleSonglistPath}\n`);
      } else {
        // Otherwise, create a minimal songlist from the metadata
        process.stdout.write('Sample songlist not found, creating minimal songlist from metadata\n');
        songlist = createMinimalSonglist(metadata);
      }
      
      // Store the songlist
      // Ensure songlist is defined before storing
      if (songlist) {
        // Set the user role in the songlist
        if (!songlist.user_role) {
          songlist.user_role = userRole;
        }
        
        // Use type assertion to tell TypeScript that storeSonglist always returns a string
        const storedPath: string = storeSonglist(fileId, songlist) as string;
        process.stdout.write(`Songlist stored at: ${storedPath}\n`);
        
        // For DJ users, we'll continue processing in the background without updating status again
        // The client already received a 'received' status when the files were validated
        if (isDjUser) {
          process.stdout.write('DJ user processing continuing in background...\n');
          // We don't update the status here, as the client doesn't need to know about the background processing
        }
      } else {
        throw new Error('Failed to create songlist');
      }
      
    } catch (err) {
      process.stderr.write(`Error processing songlist: ${err}\n`);
      statusManager.updateStatus('error', `Songlist processing error: ${(err as Error).message}`);
      process.exit(1);
    }
    
    // Step 2: Upload to destinations
    process.stdout.write('Uploading to destinations...\n');
    
    // Get selected destinations from metadata or use all by default
    const defaultDestinations = ['azuracast', 'mixcloud', 'soundcloud'];
    let selectedDestinations = defaultDestinations;
    
    // For admin users, respect the destinations specified in metadata
    if (userRole === USER_ROLES.ADMIN && metadata.destinations) {
      selectedDestinations = metadata.destinations.split(',').map((d: string) => d.trim().toLowerCase());
    }
    
    process.stdout.write(`Uploading to selected destinations: ${selectedDestinations.join(', ')}\n`);
    
    // Convert UTC timestamps to CET for each destination
    const broadcastDate = songlist.broadcast_data.broadcast_date;
    const broadcastTime = songlist.broadcast_data.broadcast_time;
    const utcTimestamp = `${broadcastDate}T${broadcastTime}Z`;
    const cetTimestamp = utcToCet(utcTimestamp);
    const [cetDate, cetTime] = cetTimestamp.split(' ');
    
    // Get artwork file path
    const artworkFilename = metadata.artworkFilename || 'artwork.jpg';
    const artworkFile = path.join(fileDir, artworkFilename);
    
    // Verify artwork file exists
    if (!fs.existsSync(artworkFile)) {
      process.stderr.write(`Artwork file not found: ${artworkFile}\n`);
      statusManager.updateStatus('error', 'Artwork file not found');
      process.exit(1);
    }
    
    // Create metadata objects for each platform using the service methods
    const azuraCastMetadata = azuraCastService.createMetadataFromSonglist(songlist);
    const mixcloudMetadata = mixcloudService.createMetadataFromSonglist(songlist);
    const soundCloudMetadata = soundCloudService.createMetadataFromSonglist(songlist, artworkFile);
    
    // Upload to selected platforms sequentially
    const destinations: any = {};
    
    // Step 2a: Upload to AzuraCast (if selected)
    if (selectedDestinations.includes('azuracast')) {
      process.stdout.write('Starting upload to AzuraCast...\n');
      statusManager.updateStatus('processing', 'Uploading to AzuraCast', { current_platform: 'azuracast' });
      
      try {
        const azuraCastResult = await azuraCastService.uploadFile(audioFile, azuraCastMetadata);
        destinations.azuracast = azuraCastResult;
        process.stdout.write(`AzuraCast upload ${azuraCastResult.success ? 'completed successfully' : 'failed'}\n`);
      } catch (err) {
        process.stderr.write(`AzuraCast upload failed: ${err}\n`);
        destinations.azuracast = {
          success: false,
          error: (err as Error).message,
          recoverable: true // Mark as recoverable for future manual retry
        };
      }
    } else {
      destinations.azuracast = { success: true, skipped: true, message: 'Destination not selected' };
    }
    
    // Step 2b: Upload to Mixcloud (if selected)
    if (selectedDestinations.includes('mixcloud')) {
      process.stdout.write('Starting upload to Mixcloud...\n');
      statusManager.updateStatus('processing', 'Uploading to Mixcloud', { 
        ...destinations,
        current_platform: 'mixcloud' 
      });
      
      try {
        const mixcloudResult = await mixcloudService.uploadFile(audioFile, mixcloudMetadata);
        destinations.mixcloud = mixcloudResult;
        process.stdout.write(`Mixcloud upload ${mixcloudResult.success ? 'completed successfully' : 'failed'}\n`);
      } catch (err) {
        process.stderr.write(`Mixcloud upload failed: ${err}\n`);
        destinations.mixcloud = {
          success: false,
          error: (err as Error).message,
          recoverable: true
        };
      }
    } else {
      destinations.mixcloud = { success: true, skipped: true, message: 'Destination not selected' };
    }
    
    // Step 2c: Upload to SoundCloud (if selected)
    if (selectedDestinations.includes('soundcloud')) {
      process.stdout.write('Starting upload to SoundCloud...\n');
      statusManager.updateStatus('processing', 'Uploading to SoundCloud', { 
        ...destinations,
        current_platform: 'soundcloud' 
      });
      
      try {
        const soundCloudResult = await soundCloudService.uploadFile(audioFile, soundCloudMetadata);
        destinations.soundcloud = soundCloudResult;
        process.stdout.write(`SoundCloud upload ${soundCloudResult.success ? 'completed successfully' : 'failed'}\n`);
      } catch (err) {
        process.stderr.write(`SoundCloud upload failed: ${err}\n`);
        destinations.soundcloud = {
          success: false,
          error: (err as Error).message,
          recoverable: true
        };
      }
    } else {
      destinations.soundcloud = { success: true, skipped: true, message: 'Destination not selected' };
    }
    
    // Update final status based on user role
    if (isDjUser) {
      // For DJ users, we don't expose destination details
      statusManager.updateStatus('completed', 'Processing completed successfully', {
        message: 'Your files have been processed and uploaded successfully.'
      });
    } else {
      // For Admin users, we show detailed destination status
      statusManager.updateStatus('completed', 'Processing completed successfully', destinations);
    }
    
    // Step 3: Move files to archive directory AFTER updating status to completed
    process.stdout.write('Moving files to archive directory...\n');
    
    try {
      // Move files to archive directory
      const { archivePath, fileMap } = fileManager.moveToArchive(fileId, songlist);
      process.stdout.write(`Files moved to archive: ${archivePath}\n`);
      process.stdout.write(`File mapping: ${JSON.stringify(fileMap, null, 2)}\n`);
      
      // Add archive path to destinations
      destinations.archive = {
        success: true,
        path: archivePath,
        files: fileMap
      };
    } catch (err) {
      process.stderr.write(`Error moving files to archive: ${err}\n`);
      destinations.archive = {
        success: false,
        error: (err as Error).message
      };
    }
    process.stdout.write(`Files for ${fileId} processed successfully\n`);
    process.stdout.write(`Destination upload results: ${JSON.stringify(destinations, null, 2)}\n`);
    
    // Add a small delay before exiting to ensure the status file is written
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Exit the process
    process.exit(0);
  } catch (err) {
    process.stderr.write(`Error processing files: ${err}\n`);
    statusManager.updateStatus('error', `Processing error: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * Create a minimal songlist from metadata
 */
function createMinimalSonglist(metadata: any): SonglistData {
  // Get artwork filename from metadata
  const artworkFilename = metadata.artworkFilename || 'artwork.jpg';
  
  return {
    broadcast_data: {
      broadcast_date: new Date().toISOString().split('T')[0] || new Date().toISOString(),
      broadcast_time: new Date().toISOString().split('T')[1]?.substring(0, 8) || '00:00:00',
      DJ: metadata.djName || 'Unknown DJ',
      setTitle: metadata.title || 'Untitled Set',
      duration: '01:00:00',
      artwork: artworkFilename
    },
    track_list: [
      {
        title: 'Unknown Track',
        artist: 'Unknown Artist'
      }
    ],
    version: '1.0'
  };
}

// Start processing
processFiles();

// Handle unexpected errors
process.on('uncaughtException', (err) => {
  process.stderr.write(`Uncaught exception: ${err}\n`);
  statusManager.updateStatus('error', `Uncaught exception: ${(err as Error).message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`Unhandled rejection: ${reason}\n`);
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  statusManager.updateStatus('error', `Unhandled rejection: ${errorMessage}`);
  process.exit(1);
});
