/**
 * File Processor
 * 
 * This module is started by the daemon to process files in isolation.
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
import { log, logError } from '@uploadDistributor/logging';

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
  logError('ERROR   ', 'FP:001', 'Invalid or missing fileId in workerData');
  process.exit(1);
}

// Define paths
const receivedFilesDir = process.env.RECEIVED_FILES_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), '../../received-files');
log('D:WORKDB', 'FP:002', `Files directory: ${receivedFilesDir}`);
const fileDir = path.join(receivedFilesDir, fileId);
const metadataFile = path.join(fileDir, 'metadata.json');

// Initialize services
const statusManager = new StatusManager(fileId);
const fileManager = new FileManager();

// Check if directory exists
if (!fs.existsSync(fileDir)) {
  logError('ERROR   ', 'FP:003', `File directory not found: ${fileDir}`);
  process.exit(1);
}

// Check if metadata file exists
if (!fs.existsSync(metadataFile)) {
  logError('ERROR   ', 'FP:004', `Metadata file not found: ${metadataFile}`);
  statusManager.updateStatus('error', 'Metadata file not found');
  process.exit(1);
}

// Read metadata first to determine actual filenames
let metadata: any;
try {
  log('D:WORKDB', 'FP:005', `Reading metadata file: ${metadataFile}`);
  const metadataContent = fs.readFileSync(metadataFile, 'utf8');
  metadata = JSON.parse(metadataContent);
  log('D:WORKDB', 'FP:006', `Metadata parsed: ${JSON.stringify(metadata, null, 2)}`);
} catch (err) {
  logError('ERROR   ', 'FP:007', `Error reading metadata:`, err);
  statusManager.updateStatus('error', 'Invalid metadata format');
  process.exit(1);
}

// Construct normalized filenames based on metadata
const normalizedBase = `${metadata.broadcastDate}_${metadata.djName.replace(/\s+/g, '_')}_${metadata.title.replace(/\s+/g, '_')}`;
const audioFile = path.join(fileDir, `${normalizedBase}.mp3`);

// Check for validated songs file
log('D:FILE  ', 'FP:030', `Using files directory: ${fileDir}`);
const songsPath = path.join(fileDir, `${normalizedBase}_Songs.json`);

// Check if required files exist with normalized names
if (!fs.existsSync(audioFile)) {
  logError('ERROR   ', 'FP:033', `Audio file not found: ${audioFile}`);
  statusManager.updateStatus('error', 'Audio file not found');
  process.exit(1);
}

// Look for songlist file with various extensions
let songlistFile = '';
const possibleExtensions = ['.nml', '.txt', '.rtf', '.docx', '.m3u8', '.json'];
for (const ext of possibleExtensions) {
  const testPath = path.join(fileDir, `${normalizedBase}${ext}`);
  if (fs.existsSync(testPath)) {
    songlistFile = testPath;
    log('D:FILE  ', 'FP:031', `Found songlist file: ${songlistFile}`);
    break;
  }
}

if (!songlistFile) {
  logError('ERROR   ', 'FP:032', `Songlist file not found for base: ${normalizedBase}`);
  statusManager.updateStatus('error', 'Songlist file not found');
  process.exit(1);
}

// Check for validated songs file, but don't fail if it doesn't exist
let hasValidatedSongs = false;
if (fs.existsSync(songsPath)) {
  log('D:FILE  ', 'FP:033', `Found validated songs file: ${songsPath}`);
  hasValidatedSongs = true;
} else {
  log('D:FILE  ', 'FP:034', `No validated songs file found, will parse songlist directly`);
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
    log('D:WORKDB', 'FP:008', `Processing files for ${fileId}`);
    log('D:WORKDB', 'FP:009', `Metadata: ${JSON.stringify(metadata, null, 2)}`);
    
    // Get user role from metadata or default to DJ
    let userRole: UserRole = USER_ROLES.DJ;
    
    if (metadata.userRole && (metadata.userRole === USER_ROLES.ADMIN || metadata.userRole === USER_ROLES.DJ)) {
      userRole = metadata.userRole;
    }
    
    // For DJ users, we can return success immediately after storing the songlist
    const isDjUser = userRole === USER_ROLES.DJ;
    
    // Step 1: Parse and normalize songlist
    log('D:WORKER', 'FP:010', 'Parsing songlist...');
    
    let songlist: SonglistData;
    
    try {
      // Check if we have validated songs from the web UI or pre-validated JSON songlist
      const songsPath = path.join(fileDir, `${normalizedBase}_Songs.json`);
      let parseResult: ParseResult;
      
      log('D:FILEDB', 'FP:040', `Checking for validated songs at: ${songsPath}`);
      
      if (hasValidatedSongs && fs.existsSync(songsPath)) {
        // Use the validated songs directly
        log('D:WORKER', 'FP:035', `Using validated songs from ${songsPath}`);
        log('D:FILEDB', 'FP:042', `Validated songs file exists: ${fs.existsSync(songsPath)}`);
        
        try {
          const songsContent = fs.readFileSync(songsPath, 'utf8');
          log('D:FILEDB', 'FP:043', `Validated songs content length: ${songsContent.length} bytes`);
          
          const songsData = JSON.parse(songsContent);
          
          // Handle both formats: array of songs directly or {songs: [...]} format
          const songs = Array.isArray(songsData) ? songsData : (songsData.songs && Array.isArray(songsData.songs) ? songsData.songs : null);
          
          if (songs) {
            parseResult = {
              songs: songs,
              error: ParseError.NONE
            };
            log('D:WORKER', 'FP:036', `Loaded ${parseResult.songs.length} validated songs`);
            log('D:FILEDB', 'FP:045', `First validated song: ${JSON.stringify(parseResult.songs[0])}`);
          } else {
            // Invalid validated data, fall back to parsing the songlist file
            logError('ERROR   ', 'FP:037', `Validated songs data is invalid, falling back to direct parsing`);
            parseResult = await parseSonglist(songlistFile);
          }
        } catch (err) {
          // Error reading validated songs, fall back to parsing the songlist file
          logError('ERROR   ', 'FP:038', `Error reading validated songs, falling back to direct parsing:`, err);
          parseResult = await parseSonglist(songlistFile);
        }
      } else {
        // No validated songs found, parse the songlist file directly
        log('D:WORKER', 'FP:048', `No validated songs found, parsing songlist file directly: ${songlistFile}`);
        parseResult = await parseSonglist(songlistFile);
        log('D:WORKER', 'FP:049', `Direct parsing complete, found ${parseResult.songs?.length || 0} songs`);
      }
      
      if (parseResult.error !== ParseError.NONE) {
        logError('ERROR   ', 'FP:011', `Failed to parse songlist: ${parseResult.error}`);
        throw new Error(`Failed to parse songlist: ${parseResult.error}`);
      }
      
      if (!parseResult.songs || parseResult.songs.length === 0) {
        log('D:WORKER', 'FP:012', 'No valid songs found in songlist, creating minimal songlist from metadata');
        songlist = createMinimalSonglist(metadata);
      } else {
      // Convert parsed songs to SonglistData format
      // Convert genre string to array by splitting on commas and trimming whitespace
      const genreArray = metadata.genre ? 
        metadata.genre.split(',').map((g: string) => g.trim()).filter((g: string) => g.length > 0) : 
        [];
        
      songlist = {
        broadcast_data: {
          broadcast_date: metadata.broadcastDate || new Date().toISOString().split('T')[0],
          broadcast_time: metadata.broadcastTime || '00:00:00',
          DJ: metadata.djName || 'Unknown DJ',
          setTitle: metadata.title || 'Untitled Set',
          genre: genreArray,
          description: metadata.description || '',
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
        log('D:WORKER', 'FP:013', `Songlist stored at: ${storedPath}`);
        
        // For DJ users, we'll continue processing in the background without updating status again
        // The client already received a 'received' status when the files were validated
        if (isDjUser) {
          log('D:WORKER', 'FP:032', 'DJ user processing continuing in background...');
          // We don't update the status here, as the client doesn't need to know about the background processing
        }
      } else {
        throw new Error('Failed to create songlist');
      }
      
    } catch (err) {
      logError('ERROR   ', 'FP:014', `Error processing songlist:`, err);
      statusManager.updateStatus('error', `Songlist processing error: ${(err as Error).message}`);
      process.exit(1);
    }
    
    // Step 2: Upload to destinations
    log('D:WORKER', 'FP:015', 'Uploading to destinations...');
    
    // For now, only use AzuraCast as the destination
    const defaultDestinations = ['azuracast'];
    let selectedDestinations = defaultDestinations;
    
    // For admin users, respect the destinations specified in metadata, but still only use AzuraCast for now
    if (userRole === USER_ROLES.ADMIN && metadata.destinations) {
      const requestedDestinations = metadata.destinations.split(',').map((d: string) => d.trim().toLowerCase());
      // Filter to only include AzuraCast
      selectedDestinations = requestedDestinations.filter((d: string) => d === 'azuracast');
      if (selectedDestinations.length === 0) {
        selectedDestinations = defaultDestinations; // Default back to AzuraCast if not specified
      }
    }
    
    log('D:WORKER', 'FP:016', `Uploading to destination: ${selectedDestinations[0]}`);
    
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
      logError('ERROR   ', 'FP:017', `Artwork file not found: ${artworkFile}`);
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
      log('D:WORKER', 'FP:018', 'Starting upload to AzuraCast...');
      statusManager.updateStatus('processing', 'Uploading to AzuraCast', { current_platform: 'azuracast' });
      
      try {
        const azuraCastResult = await azuraCastService.uploadFile(audioFile, azuraCastMetadata, songlist);
        destinations.azuracast = azuraCastResult;
        log('D:WORKER', 'FP:019', `AzuraCast upload ${azuraCastResult.success ? 'completed successfully' : 'failed'}`);
      } catch (err) {
        logError('ERROR   ', 'FP:020', `AzuraCast upload failed:`, err);
        destinations.azuracast = {
          success: false,
          error: (err as Error).message,
          recoverable: true // Mark as recoverable for future manual retry
        };
      }
    } else {
      destinations.azuracast = { success: true, skipped: true, message: 'Destination not selected' };
    }
    
    // Skip Mixcloud and SoundCloud uploads for now
    destinations.mixcloud = { success: true, skipped: true, message: 'Destination not implemented yet' };
    destinations.soundcloud = { success: true, skipped: true, message: 'Destination not implemented yet' };
    
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
    log('D:WORKER', 'FP:021', 'Moving files to archive directory...');
    
    try {
      // Move files to archive directory
      const { archivePath, fileMap } = fileManager.moveToArchive(fileId, songlist);
      log('D:WORKER', 'FP:022', `Files moved to archive: ${archivePath}`);
      log('D:WORKDB', 'FP:023', `File mapping: ${JSON.stringify(fileMap, null, 2)}`);
      
      // Add archive path to destinations
      destinations.archive = {
        success: true,
        path: archivePath,
        files: fileMap
      };
    } catch (err) {
      logError('ERROR   ', 'FP:024', `Error moving files to archive:`, err);
      destinations.archive = {
        success: false,
        error: (err as Error).message
      };
    }
    log('D:WORKER', 'FP:025', `Files for ${fileId} processed successfully`);
    log('D:WORKER', 'FP:026', `AzuraCast upload result: ${destinations.azuracast.success ? 'Success' : 'Failed'}`);
    
    // Add a small delay before exiting to ensure the status file is written
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Exit the process
    process.exit(0);
  } catch (err) {
    logError('ERROR   ', 'FP:027', `Error processing files:`, err);
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
  
  // Convert genre string to array by splitting on commas and trimming whitespace
  const genreArray = metadata.genre ? 
    metadata.genre.split(',').map((g: string) => g.trim()).filter((g: string) => g.length > 0) : 
    [];
  
  return {
    broadcast_data: {
      broadcast_date: metadata.broadcastDate || new Date().toISOString().split('T')[0],
      broadcast_time: metadata.broadcastTime || '00:00:00',
      DJ: metadata.djName || 'Unknown DJ',
      setTitle: metadata.title || 'Untitled Set',
      genre: genreArray,
      description: metadata.description || '',
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
  logError('ERROR   ', 'FP:028', `Uncaught exception:`, err);
  statusManager.updateStatus('error', `Uncaught exception: ${(err as Error).message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError('ERROR   ', 'FP:029', `Unhandled rejection:`, reason);
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  statusManager.updateStatus('error', `Unhandled rejection: ${errorMessage}`);
  process.exit(1);
});
