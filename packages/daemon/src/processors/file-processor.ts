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
  storeSonglist 
} from '../storage/SonglistStorage.js';
import { parseSonglist, ParseResult, ParseError } from '@uploadDistributor/songlist-parser';
import { USER_ROLES, UserRole } from '../services/AuthService.js';
import { utcToCet } from '../utils/TimezoneUtils.js';

// Import services
import { StatusManager } from '../services/StatusManager.js';
import { AzuraCastService } from '../services/AzuraCastService.js';
import { MixcloudService } from '../services/MixcloudService.js';
import { SoundCloudService } from '../services/SoundCloudService.js';
import { FileManager } from '../services/FileManager.js';

// Load environment variables
dotenv.config();

import { workerData } from 'worker_threads';

const fileId: string = workerData;

if (!fileId || typeof fileId !== 'string') {
  process.stderr.write('Invalid or missing fileId in workerData\n');
  process.exit(1);
}

// Define paths
const receivedFilesDir = process.env.RECEIVED_FILES_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), '../../received-files');
process.stdout.write(`Files directory: ${receivedFilesDir}\n`);
const fileDir = path.join(receivedFilesDir, fileId);
const metadataFile = path.join(fileDir, 'metadata.json');

// Initialize services
const statusManager = new StatusManager(fileId);
const fileManager = new FileManager();

// Check if directory exists
if (!fs.existsSync(fileDir)) {
  process.stderr.write(`File directory not found: ${fileDir}\n`);
  process.exit(1);
}

// Check if metadata file exists
if (!fs.existsSync(metadataFile)) {
  process.stderr.write(`Metadata file not found: ${metadataFile}\n`);
  statusManager.updateStatus('error', 'Metadata file not found');
  process.exit(1);
}

// Read metadata first to determine actual filenames
let metadata: any;
try {
  const metadataContent = fs.readFileSync(metadataFile, 'utf8');
  metadata = JSON.parse(metadataContent);
} catch (err) {
  process.stderr.write(`Error reading metadata: ${err}\n`);
  statusManager.updateStatus('error', 'Invalid metadata format');
  process.exit(1);
}

// Construct normalized filenames based on metadata
const normalizedBase = `${metadata.broadcastDate}_${metadata.djName.replace(/\s+/g, '_')}_${metadata.title.replace(/\s+/g, '_')}`;
const audioFile = path.join(fileDir, `${normalizedBase}.mp3`);

// Find the songlist file by checking for all supported extensions
process.stdout.write(`Using files directory: ${fileDir}\n`);
const possibleExtensions = ['.txt', '.rtf', '.docx', '.nml', '.m3u8'];
let songlistFile = '';

for (const ext of possibleExtensions) {
  const testPath = path.join(fileDir, `${normalizedBase}${ext}`);
  if (fs.existsSync(testPath)) {
    songlistFile = testPath;
    process.stdout.write(`Found songlist file: ${songlistFile}\n`);
    break;
  }
}

// Check if required files exist with normalized names
if (!fs.existsSync(audioFile)) {
  process.stderr.write(`Audio file not found: ${audioFile}\n`);
  statusManager.updateStatus('error', 'Audio file not found');
  process.exit(1);
}

if (!songlistFile) {
  process.stderr.write(`Songlist file not found for base: ${normalizedBase}\n`);
  statusManager.updateStatus('error', 'Songlist file not found');
  process.exit(1);
}

// Initialize platform services
const azuraCastService = new AzuraCastService(statusManager);
const mixcloudService = new MixcloudService(statusManager);
const soundCloudService = new SoundCloudService(statusManager);

export async function processFile(fileId: string) {
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
    
    let songlist: SonglistData;
    
    try {
      // Parse the actual songlist file
      const parseResult: ParseResult = await parseSonglist(songlistFile);
      
      if (parseResult.error !== ParseError.NONE) {
        throw new Error(`Failed to parse songlist: ${parseResult.error}`);
      }
      
      if (!parseResult.songs || parseResult.songs.length === 0) {
        process.stdout.write('No valid songs found in songlist, creating minimal songlist from metadata\n');
        songlist = createMinimalSonglist(metadata);
      } else {
        // Convert parsed songs to SonglistData format
        songlist = {
          broadcast_data: {
            broadcast_date: new Date().toISOString().split('T')[0] || new Date().toISOString(),
            broadcast_time: (new Date().toISOString().split('T')[1] || '').substring(0, 8) || '00:00:00',
            DJ: metadata.djName || 'Unknown DJ',
            setTitle: metadata.title || 'Untitled Set',
            duration: '01:00:00', // TODO: Calculate actual duration from MP3 file
            artwork: metadata.artworkFilename || 'artwork.jpg'
          },
          track_list: parseResult.songs,
          version: '1.0'
        };
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
      broadcast_time: (new Date().toISOString().split('T')[1] || '').substring(0, 8) || '00:00:00',
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
