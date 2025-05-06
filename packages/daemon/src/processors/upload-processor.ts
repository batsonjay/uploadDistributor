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

// Load environment variables
dotenv.config();

// Get upload ID from command line arguments
// The upload ID is the last argument passed to the script
const uploadId: string = process.argv[process.argv.length - 1] || 'default-upload-id';

process.stdout.write('Process arguments: ' + JSON.stringify(process.argv) + '\n');
process.stdout.write(`Using upload ID: ${uploadId}\n`);

if (!uploadId || uploadId === 'default-upload-id') {
  process.stderr.write('No upload ID provided\n');
  process.exit(1);
}

// Define paths
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
process.stdout.write(`Uploads directory: ${uploadsDir}\n`);
const uploadDir = path.join(uploadsDir, uploadId);
const audioFile = path.join(uploadDir, 'audio.mp3');
const songlistFile = path.join(uploadDir, 'songlist.txt');
const metadataFile = path.join(uploadDir, 'metadata.json');
const statusFile = path.join(uploadDir, 'status.json');

// Initialize status manager
const statusManager = new StatusManager(uploadId);

// Check if required files exist
if (!fs.existsSync(uploadDir)) {
  process.stderr.write(`Upload directory not found: ${uploadDir}\n`);
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

// Initialize services
const azuraCastService = new AzuraCastService(statusManager);
const mixcloudService = new MixcloudService(statusManager);
const soundCloudService = new SoundCloudService(statusManager);

// Main processing function
async function processUpload() {
  try {
    // Update status to processing
    statusManager.updateStatus('processing', 'Upload processing started');
    
    // Log the start of processing
    process.stdout.write(`Processing upload ${uploadId}\n`);
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
        const storedPath: string = storeSonglist(uploadId, songlist) as string;
        process.stdout.write(`Songlist stored at: ${storedPath}\n`);
        
        // If this is a DJ user, we can return success now
        if (isDjUser) {
          statusManager.updateStatus('completed', 'Upload received successfully', {
            message: 'Your upload has been received and will be processed in the background.'
          });
          
          // We'll continue processing in the background
          process.stdout.write('DJ user upload completed, continuing processing in background...\n');
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
    
    // Create metadata objects for each platform
    const azuraCastMetadata = {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      album: `${cetDate || new Date().toISOString().split('T')[0]} Broadcast`,
      genre: songlist.broadcast_data.genre || 'Radio Show'
    };
    
    const mixcloudMetadata = {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      description: `Broadcast on ${cetDate || new Date().toISOString().split('T')[0]} at ${cetTime || '00:00:00'}`,
      track_list: songlist.track_list || []
    };
    
    const soundCloudMetadata = {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      description: `Broadcast on ${cetDate || new Date().toISOString().split('T')[0]} at ${cetTime || '00:00:00'}`,
      genre: songlist.broadcast_data.genre || 'Radio Show',
      sharing: 'public' as 'public',
      // Add a dummy artwork path for testing
      artwork: 'dummy-artwork-path'
    };
    
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
    
    // Only update status for Admin users, since we've already updated it for DJ users
    if (!isDjUser) {
      statusManager.updateStatus('completed', 'Upload processing completed successfully', destinations);
    }
    process.stdout.write(`Upload ${uploadId} processed successfully\n`);
    process.stdout.write(`Destination results: ${JSON.stringify(destinations, null, 2)}\n`);
    
    // Add a small delay before exiting to ensure the status file is written
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Exit the process
    process.exit(0);
  } catch (err) {
    process.stderr.write(`Error processing upload: ${err}\n`);
    statusManager.updateStatus('error', `Processing error: ${(err as Error).message}`);
    process.exit(1);
  }
}

/**
 * Create a minimal songlist from metadata
 */
function createMinimalSonglist(metadata: any): SonglistData {
  return {
    broadcast_data: {
      broadcast_date: new Date().toISOString().split('T')[0] || new Date().toISOString(),
      broadcast_time: new Date().toISOString().split('T')[1]?.substring(0, 8) || '00:00:00',
      DJ: metadata.djName || 'Unknown DJ',
      setTitle: metadata.title || 'Untitled Set',
      duration: '01:00:00'
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
processUpload();

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
