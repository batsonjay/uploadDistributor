/**
 * Send Routes
 * 
 * This file defines the send routes for the application.
 * It provides endpoints for sending files with support for DJ selection by Super Admins.
 */

import express from 'express';
import busboy from 'busboy';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { anyAuthenticated } from '../middleware/roleVerification.js';
import { AuthService, USER_ROLES } from '../services/AuthService.js';
import { log, logError } from '@uploadDistributor/logging';
import { CleanupManager } from '../services/CleanupManager.js';

const router = express.Router();
const authService = AuthService.getInstance();

// Get received files directory from environment or use default
const receivedFilesDir = process.env.RECEIVED_FILES_DIR || path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '../../received-files'
).replace(/^\/([A-Za-z]):/, "$1:"); // Fix Windows paths

// Create received files directory if it doesn't exist
if (!fs.existsSync(receivedFilesDir)) {
  fs.mkdirSync(receivedFilesDir, { recursive: true });
}

/**
 * Process endpoint - handles files sent from clients to the daemon
 * Supports DJ selection by Super Admins
 * 
 * @route POST /send/process
 * @param {string} req.body.selectedDjId - Optional DJ ID for admin uploads
 * @param {file} req.files.audio - Audio file
 * @param {file} req.files.artwork - Artwork file
 * @param {file} req.files.songlist - Songlist file
 * @returns {object} 200 - File ID and status
 */
router.post('/process', anyAuthenticated, async (req: express.Request, res: express.Response) => {
  try {
    // Get the authenticated user from the request
    const authUser = (req as any).user;
    
    // Get file ID from request or generate a new one
    const fileId = req.headers['x-file-id'] || uuidv4();
    
    // Create directory for this file set
    const fileDir = path.join(receivedFilesDir, fileId as string);
    
    // If directory exists, clean it up for reuse
    if (fs.existsSync(fileDir)) {
      // Keep the directory but remove any existing files
      const files = fs.readdirSync(fileDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(fileDir, file));
      });
    } else {
      // Create new directory
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    // Initialize metadata object
    const metadata: Record<string, string> = {
      userId: (authUser?.id || ''),
      title: '',
      djName: '',
      broadcastDate: '',
      broadcastTime: '',
      genre: '',
      description: '',
      azcFolder: '',
      azcPlaylist: '',
      userRole: (authUser?.role || ''),
      destinations: 'azuracast,mixcloud,soundcloud', // Default to all destinations
      artworkFilename: '' // Store the artwork filename
    };
    
    // Check if a DJ was selected (only for admin users)
    let effectiveUser = authUser;
    let selectedDjId = '';
    
    // Set up busboy to handle file receiving
    const bb = busboy({ headers: req.headers });
    
    // Buffer to store files until we have metadata
    const fileBuffers: { [key: string]: { buffer: Buffer[], info: any } } = {};
    
    // Handle file receiving
    bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
      // Initialize buffer for this file
      fileBuffers[name] = {
        buffer: [],
        info
      };
      
      // Collect file data in memory
      file.on('data', (data) => {
        if (fileBuffers[name]) {
          fileBuffers[name].buffer.push(data);
        }
      });
    });
    
    // Handle metadata fields
    bb.on('field', (name: string, val: string) => {
      if (name === 'selectedDjId') {
        selectedDjId = val;
      } else if (name === 'metadata') {
        // Parse the metadata JSON
        try {
          const parsedMetadata = JSON.parse(val);
          // Copy all fields from parsedMetadata to metadata
          for (const key in parsedMetadata) {
            if (Object.prototype.hasOwnProperty.call(parsedMetadata, key)) {
              metadata[key] = parsedMetadata[key];
            }
          }
          log('D:RTEDB ', 'RO:001', `Parsed metadata: ${JSON.stringify(metadata, null, 2)}`);
        } catch (err) {
          logError('D:RTEDB ', 'RO:002', `Error parsing metadata: ${err}`);
        }
      } else if (name in metadata) {
        metadata[name] = val;
      }
    });
    
    // Handle completion
    bb.on('finish', async () => {
      // Process DJ selection if applicable
      if (authUser.role === USER_ROLES.ADMIN && selectedDjId) {
        log('D:ROUTE ', 'SE:001', `Admin ${authUser.displayName} attempting to upload as DJ ID: ${selectedDjId}`);
        
        // Get the selected DJ's information
        const selectedDj = await authService.getUserById(selectedDjId);
        if (selectedDj.success && selectedDj.user) {
          // Use the selected DJ as the effective user for this upload
          effectiveUser = selectedDj.user;
          log('D:ROUTE ', 'SE:002', `Admin ${authUser.displayName} uploading on behalf of DJ ${effectiveUser.displayName}`);
        } else {
          log('D:ROUTE ', 'SE:003', `Admin ${authUser.displayName} attempted to upload as invalid DJ ID: ${selectedDjId}`);
          logError('ERROR   ', 'SE:003', `Admin ${authUser.displayName} attempted to upload as invalid DJ ID: ${selectedDjId}`);
          return res.status(400).json({
            success: false,
            error: 'Invalid DJ selected'
          });
        }
      }
      
      // Check if we have all required metadata
      if (!metadata.broadcastDate || !metadata.title) {
        log('D:ROUTE ', 'SE:004', `Missing required metadata fields: broadcastDate=${metadata.broadcastDate}, title=${metadata.title}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid metadata',
          message: 'Missing required metadata fields'
        });
      }
      
      // Check if we have all required files
      if (!fileBuffers.audio || !fileBuffers.artwork || !fileBuffers.songlist) {
        log('D:ROUTE ', 'SE:005', `Missing required files: audio=${!!fileBuffers.audio}, artwork=${!!fileBuffers.artwork}, songlist=${!!fileBuffers.songlist}`);
        return res.status(400).json({
          success: false,
          error: 'Missing required files',
          message: 'Audio, artwork, and songlist files are required'
        });
      }
      
      // Use the effective user's display name for file naming
      const userDisplayName = effectiveUser.displayName;
      
      // Now that we have metadata, save the buffered files
      const normalizedBase = `${metadata.broadcastDate}_${userDisplayName.replace(/\s+/g, '_')}_${metadata.title.replace(/\s+/g, '_')}`;
      
      // Variable to store pre-validated songs if present
      let preValidatedSongs = null;
      
      // Save each buffered file
      for (const [name, fileData] of Object.entries(fileBuffers)) {
        if (!fileData.buffer || !fileData.info) {
          log('D:ROUTE ', 'SE:006', `Missing buffer or info for file: ${name}`);
          continue;
        }
        let saveTo;
        if (name === 'audio') {
          const ext = path.extname(fileData.info.filename) || '.mp3';
          saveTo = path.join(fileDir, `${normalizedBase}${ext}`);
        } else if (name === 'songlist') {
          const ext = path.extname(fileData.info.filename);
          saveTo = path.join(fileDir, `${normalizedBase}${ext}`);
          
          // Check if this is a JSON songlist with pre-validated songs
          if (ext.toLowerCase() === '.json') {
            log('D:RTEDB ', 'SE:025', `Detected JSON file extension for songlist: ${fileData.info.filename}`);
            try {
              const fileContent = Buffer.concat(fileData.buffer).toString('utf8');
              log('D:RTEDB ', 'SE:026', `JSON songlist content length: ${fileContent.length} bytes`);
              const jsonData = JSON.parse(fileContent);
              log('D:RTEDB ', 'SE:027', `Parsed JSON songlist data: ${JSON.stringify(jsonData, null, 2)}`);
              
              // Check if this is our special format with pre-validated songs
              if (jsonData.format === 'json' && Array.isArray(jsonData.songs)) {
                log('D:ROUTE ', 'SE:023', `Detected pre-validated JSON songlist with ${jsonData.songs.length} songs`);
                log('D:RTEDB ', 'SE:028', `First song in pre-validated list: ${JSON.stringify(jsonData.songs[0])}`);
                preValidatedSongs = jsonData.songs;
                
                // Save the pre-validated songs to the standard _Songs.json format for consistency
                const songsPath = path.join(fileDir, `${normalizedBase}_Songs.json`);
                fs.writeFileSync(songsPath, JSON.stringify(preValidatedSongs, null, 2));
                log('D:RTEDB ', 'SE:029', `Saved pre-validated songs to: ${songsPath}`);
                
                // Add a flag to metadata to indicate we have pre-validated songs
                metadata.hasPreValidatedSongs = 'true';
                log('D:RTEDB ', 'SE:030', `Set hasPreValidatedSongs flag in metadata to true`);
              } else {
                log('D:RTEDB ', 'SE:031', `JSON file does not contain pre-validated songs format`);
              }
            } catch (err) {
              // If there's an error parsing the JSON, just treat it as a regular songlist file
              logError('ERROR   ', 'SE:024', `Error parsing JSON songlist:`, err);
            }
          } else {
            log('D:RTEDB ', 'SE:032', `Non-JSON songlist file extension: ${ext}`);
          }
        } else if (name === 'artwork') {
          const ext = path.extname(fileData.info.filename) || '.jpg';
          saveTo = path.join(fileDir, `${normalizedBase}${ext}`);
          metadata.artworkFilename = `${normalizedBase}${ext}`;
        } else {
          log('D:ROUTE ', 'SE:007', `Skipping unknown file type: ${name}`);
          continue;
        }
        
        // Write the buffered file to disk
        fs.writeFileSync(saveTo, Buffer.concat(fileData.buffer));
      }
      
      // Update metadata with effective user information
      metadata.userId = effectiveUser.id;
      metadata.djName = userDisplayName;
      metadata.userRole = effectiveUser.role;
      if (authUser.id !== effectiveUser.id) {
        metadata.uploadedBy = authUser.displayName;
      }
      
      // Save metadata
      fs.writeFileSync(
        path.join(fileDir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
      
      // Create initial status file with 'received' status
      fs.writeFileSync(
        path.join(fileDir, 'status.json'),
        JSON.stringify({
          status: 'received',
          message: 'Files successfully received and validated',
          timestamp: new Date().toISOString()
        }, null, 2)
      );
      log('D:ROUTE ', 'SE:008', `Created status file for ${fileId}`);
      
      // Start worker thread to process the file
      const { Worker } = await import('node:worker_threads');
      const workerPath = new URL('../processors/file-processor-worker.js', import.meta.url).pathname;
      
      log('D:RTEDB ', 'SE:009', `Starting file processing for ${fileId}`);
      
      try {
        const worker = new Worker(workerPath, {
          workerData: fileId
        });

        worker.on('error', (err) => {
          logError('ERROR   ', 'SE:010', `Worker error for ${fileId}:`, err);
        });
      } catch (workerErr) {
        logError('ERROR   ', 'SE:011', `Failed to start worker thread for ${fileId}:`, workerErr);
        return res.status(500).json({
          success: false,
          error: 'Worker thread error',
          message: `Failed to start worker thread: ${workerErr instanceof Error ? workerErr.message : String(workerErr)}`
        });
      }
      
      // Return file ID to client with 'received' status
      log('D:ROUTE ', 'SE:012', `File ${fileId} successfully received and validated`);
      res.json({
        success: true,
        fileId: fileId,
        status: 'received',
        message: 'Files successfully received and validated'
      });
    });
    
    // Handle errors
    bb.on('error', (err: Error) => {
      logError('ERROR   ', 'SE:013', `File receiving error:`, err);
      res.status(500).json({
        success: false,
        error: 'File receiving failed',
        message: err.message
      });
    });
    
    // Pipe request to busboy
    req.pipe(bb);
  } catch (err) {
    logError('ERROR   ', 'SE:014', `Error in send process:`, err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

/**
 * Get status for a specific file ID
 * @route GET /send/status/:fileId
 * @returns {object} 200 - Status information
 */
router.get('/status/:fileId', anyAuthenticated, async (req: express.Request, res: express.Response) => {
  const fileId = req.params.fileId;
  if (!fileId) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'File ID is required'
    });
  }
  const fileDir = path.join(receivedFilesDir, fileId);

  try {
    log('D:RTEDB ', 'SE:015', `Getting status for file ID: ${fileId}`);
    // Check if directory exists
    if (!fs.existsSync(fileDir)) {
      log('D:ROUTE ', 'SE:016', `File ID not found: ${fileId}`);
      return res.status(404).json({
        error: 'Not found',
        message: 'File ID not found'
      });
    }

    // Check if status file exists
    const statusPath = path.join(fileDir, 'status.json');
    if (!fs.existsSync(statusPath)) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Status information not found'
      });
    }

    // Read status file
    const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    
    log('D:RTEDB ', 'SE:017', `Status for ${fileId}: ${JSON.stringify(status)}`);
    // Return status information
    res.json(status);
  } catch (err) {
    logError('ERROR   ', 'SE:018', `Error getting status for ${fileId}:`, err);
    res.status(500).json({
      error: 'Status retrieval failed',
      message: err instanceof Error ? err.message : 'Failed to get status'
    });
  }
});

/**
 * Check if a file has been archived and get its status
 * @route GET /send/archive-status/:fileId
 * @returns {object} 200 - Archive status information
 */
router.get('/archive-status/:fileId', anyAuthenticated, async (req: express.Request, res: express.Response) => {
  const fileId = req.params.fileId;
  if (!fileId) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'File ID is required'
    });
  }

  try {
    log('D:RTEDB ', 'SE:019', `Checking archive status for file ID: ${fileId}`);
    // Create CleanupManager instance
    const cleanupManager = new CleanupManager();
    
    // Get the archive directory
    const archiveDir = cleanupManager.getArchiveDir();
    
    // Search for comprehensive JSON files in the archive that contain this fileId
    let found = false;
    let archiveData = null;
    
    // Get the current year for a reasonable starting point, but also check previous year
    const currentYear = new Date().getFullYear();
    const yearsToCheck = [currentYear.toString(), (currentYear - 1).toString()];
    
    for (const year of yearsToCheck) {
      const yearDir = path.join(archiveDir, year);
      
      if (fs.existsSync(yearDir)) {
        // Read all files in the year directory
        const files = fs.readdirSync(yearDir);
        
        // Look for comprehensive JSON files (not status files)
        for (const file of files) {
          if (file.endsWith('.json') && !file.endsWith('_status.json')) {
            const filePath = path.join(yearDir, file);
            try {
              const fileContent = fs.readFileSync(filePath, 'utf8');
              const jsonData = JSON.parse(fileContent);
              
              // Check if this comprehensive file contains our fileId in the summary section
              if (jsonData.summary && jsonData.summary.fileId === fileId) {
                found = true;
                archiveData = jsonData;
                log('D:ROUTE ', 'SE:020', `File ${fileId} found in archive: ${file}`);
                break;
              }
            } catch (err) {
              // Skip files that can't be parsed
              continue;
            }
          }
        }
        
        if (found) break;
      }
    }
    
    if (found && archiveData) {
      // Extract status information from the comprehensive archive data
      const status = {
        status: 'completed',
        message: 'File successfully processed and archived',
        timestamp: archiveData.summary.timestamp || new Date().toISOString(),
        fileId: fileId,
        uploads: archiveData.uploads || {},
        trackCount: archiveData.summary.trackCount || 0,
        dj: archiveData.summary.dj || 'Unknown',
        title: archiveData.summary.title || 'Unknown'
      };
      
      return res.json({
        success: true,
        archived: true,
        status: status,
        archiveData: archiveData
      });
    } else {
      log('D:ROUTE ', 'SE:021', `File ${fileId} not found in archive`);
      return res.json({
        success: true,
        archived: false
      });
    }
  } catch (err) {
    logError('ERROR   ', 'SE:022', `Error checking archive status for ${fileId}:`, err);
    return res.status(500).json({
      error: 'Archive status check failed',
      message: err instanceof Error ? err.message : 'Failed to check archive status'
    });
  }
});

export { router as sendRoutes };
