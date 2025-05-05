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
import { AzuraCastApiMock } from '../mocks/AzuraCastApiMock';
import { MixcloudApiMock } from '../mocks/MixcloudApiMock';
import { SoundCloudApiMock } from '../mocks/SoundCloudApiMock';

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

// Check if required files exist
if (!fs.existsSync(uploadDir)) {
  process.stderr.write(`Upload directory not found: ${uploadDir}\n`);
  process.exit(1);
}

if (!fs.existsSync(audioFile)) {
  process.stderr.write(`Audio file not found: ${audioFile}\n`);
  updateStatus('error', 'Audio file not found');
  process.exit(1);
}

if (!fs.existsSync(songlistFile)) {
  process.stderr.write(`Songlist file not found: ${songlistFile}\n`);
  updateStatus('error', 'Songlist file not found');
  process.exit(1);
}

if (!fs.existsSync(metadataFile)) {
  process.stderr.write(`Metadata file not found: ${metadataFile}\n`);
  updateStatus('error', 'Metadata file not found');
  process.exit(1);
}

// Read metadata
let metadata: any;
try {
  const metadataContent = fs.readFileSync(metadataFile, 'utf8');
  metadata = JSON.parse(metadataContent);
} catch (err) {
  process.stderr.write(`Error reading metadata: ${err}\n`);
  updateStatus('error', 'Invalid metadata format');
  process.exit(1);
}

// Initialize API mocks
const azuraCastApi = new AzuraCastApiMock();
const mixcloudApi = new MixcloudApiMock();
const soundCloudApi = new SoundCloudApiMock();

// Main processing function
async function processUpload() {
  try {
    // Update status to processing
    updateStatus('processing', 'Upload processing started');
    
    // Log the start of processing
    process.stdout.write(`Processing upload ${uploadId}\n`);
    process.stdout.write(`Metadata: ${JSON.stringify(metadata, null, 2)}\n`);
    
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
        songlist = {
          broadcast_data: {
            broadcast_date: new Date().toISOString().split('T')[0],
            broadcast_time: new Date().toISOString().split('T')[1].substring(0, 8),
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
      
      // Store the songlist
      // Ensure songlist is defined before storing
      if (songlist) {
        // Use type assertion to tell TypeScript that storeSonglist always returns a string
        const storedPath = storeSonglist(uploadId, songlist) as string;
        process.stdout.write(`Songlist stored at: ${storedPath}\n`);
      } else {
        throw new Error('Failed to create songlist');
      }
      
    } catch (err) {
      process.stderr.write(`Error processing songlist: ${err}\n`);
      updateStatus('error', `Songlist processing error: ${(err as Error).message}`);
      process.exit(1);
    }
    
    // Step 2: Upload to destinations
    process.stdout.write('Uploading to destinations...\n');
    
    // Create metadata objects for each platform
    const azuraCastMetadata = {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      album: `${songlist.broadcast_data.broadcast_date || new Date().toISOString().split('T')[0]} Broadcast`,
      genre: 'Radio Show'
    };
    
    const mixcloudMetadata = {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      description: `Broadcast on ${songlist.broadcast_data.broadcast_date || new Date().toISOString().split('T')[0]} at ${songlist.broadcast_data.broadcast_time || '00:00:00'}`,
      track_list: songlist.track_list || []
    };
    
    const soundCloudMetadata = {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      description: `Broadcast on ${songlist.broadcast_data.broadcast_date || new Date().toISOString().split('T')[0]} at ${songlist.broadcast_data.broadcast_time || '00:00:00'}`,
      genre: 'Radio Show',
      sharing: 'public' as 'public'
    };
    
    // Upload to all platforms in parallel
    const [azuraCastResult, mixcloudResult, soundCloudResult] = await Promise.all([
      uploadToAzuraCast(audioFile, azuraCastMetadata),
      uploadToMixcloud(audioFile, mixcloudMetadata),
      uploadToSoundCloud(audioFile, soundCloudMetadata)
    ]);
    
    // Collect results
    const destinations = {
      azuracast: azuraCastResult,
      mixcloud: mixcloudResult,
      soundcloud: soundCloudResult
    };
    
    // Update status to completed with destination results
    updateStatus('completed', 'Upload processing completed successfully', destinations);
    process.stdout.write(`Upload ${uploadId} processed successfully\n`);
    process.stdout.write(`Destination results: ${JSON.stringify(destinations, null, 2)}\n`);
    
    // Exit the process
    process.exit(0);
  } catch (err) {
    process.stderr.write(`Error processing upload: ${err}\n`);
    updateStatus('error', `Processing error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// Helper function to upload to AzuraCast
async function uploadToAzuraCast(audioFilePath: string, metadata: any) {
  try {
    process.stdout.write('Uploading to AzuraCast...\n');
    
    // Step 1: Upload the file
    const uploadResult = await azuraCastApi.uploadFile(audioFilePath, metadata);
    
    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error || 'Unknown error'
      };
    }
    
    // Step 2: Set metadata
    const metadataResult = await azuraCastApi.setMetadata(uploadResult.id, metadata);
    
    if (!metadataResult.success) {
      return {
        success: false,
        error: metadataResult.error || 'Failed to set metadata'
      };
    }
    
    // Step 3: Add to playlist
    const playlistResult = await azuraCastApi.addToPlaylist(uploadResult.id);
    
    if (!playlistResult.success) {
      return {
        success: false,
        error: playlistResult.error || 'Failed to add to playlist'
      };
    }
    
    // Return success
    return {
      success: true,
      id: uploadResult.id,
      path: uploadResult.path
    };
  } catch (err) {
    process.stderr.write(`AzuraCast upload error: ${err}\n`);
    return {
      success: false,
      error: (err as Error).message
    };
  }
}

// Helper function to upload to Mixcloud
async function uploadToMixcloud(audioFilePath: string, metadata: any) {
  try {
    process.stdout.write('Uploading to Mixcloud...\n');
    
    // Upload the file with metadata
    const uploadResult = await mixcloudApi.uploadFile(audioFilePath, metadata);
    
    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error || 'Unknown error'
      };
    }
    
    // Return success
    return {
      success: true,
      id: uploadResult.id,
      url: uploadResult.url
    };
  } catch (err) {
    process.stderr.write(`Mixcloud upload error: ${err}\n`);
    return {
      success: false,
      error: (err as Error).message
    };
  }
}

// Helper function to upload to SoundCloud
async function uploadToSoundCloud(audioFilePath: string, metadata: any) {
  try {
    process.stdout.write('Uploading to SoundCloud...\n');
    
    // Upload the file with metadata
    const uploadResult = await soundCloudApi.uploadFile(audioFilePath, metadata);
    
    if (!uploadResult.success) {
      return {
        success: false,
        error: uploadResult.error || 'Unknown error'
      };
    }
    
    // Return success
    return {
      success: true,
      id: uploadResult.id,
      url: uploadResult.permalink_url
    };
  } catch (err) {
    process.stderr.write(`SoundCloud upload error: ${err}\n`);
    return {
      success: false,
      error: (err as Error).message
    };
  }
}

// Helper function to update status
function updateStatus(status: string, message: string, destinations?: any) {
  const statusData: any = {
    status,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (destinations) {
    statusData.destinations = destinations;
  }
  
  fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2));
}

// Start processing
processUpload();

// Handle unexpected errors
process.on('uncaughtException', (err) => {
  process.stderr.write(`Uncaught exception: ${err}\n`);
  updateStatus('error', `Uncaught exception: ${(err as Error).message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`Unhandled rejection: ${reason}\n`);
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  updateStatus('error', `Unhandled rejection: ${errorMessage}`);
  process.exit(1);
});
