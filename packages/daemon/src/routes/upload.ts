/**
 * Upload Routes
 * 
 * This file defines the upload routes for the application.
 * It provides endpoints for uploading files with support for DJ selection by Super Admins.
 */

import express from 'express';
import busboy from 'busboy';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { anyAuthenticated } from '../middleware/roleVerification.js';
import { AuthService, USER_ROLES } from '../services/AuthService.js';
import { logParserEvent, ParserLogType } from '../utils/LoggingUtils.js';

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
 * Upload endpoint - handles files sent from clients to the daemon
 * Supports DJ selection by Super Admins
 * 
 * @route POST /upload
 * @param {string} req.body.selectedDjId - Optional DJ ID for admin uploads
 * @param {file} req.files.audio - Audio file
 * @param {file} req.files.artwork - Artwork file
 * @param {file} req.files.songlist - Songlist file
 * @returns {object} 200 - File ID and status
 */
router.post('/', anyAuthenticated, async (req: express.Request, res: express.Response) => {
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
      } else if (name in metadata) {
        metadata[name] = val;
      }
    });
    
    // Handle completion
    bb.on('finish', async () => {
      // Process DJ selection if applicable
      if (authUser.role === USER_ROLES.ADMIN && selectedDjId) {
        logParserEvent('UploadRoutes', ParserLogType.INFO, 
          `Admin ${authUser.displayName} attempting to upload as DJ ID: ${selectedDjId}`);
        
        // Get the selected DJ's information
        const selectedDj = await authService.getUserById(selectedDjId);
        if (selectedDj.success && selectedDj.user) {
          // Use the selected DJ as the effective user for this upload
          effectiveUser = selectedDj.user;
          logParserEvent('UploadRoutes', ParserLogType.INFO,
            `Admin ${authUser.displayName} uploading on behalf of DJ ${effectiveUser.displayName}`);
        } else {
          logParserEvent('UploadRoutes', ParserLogType.WARNING,
            `Admin ${authUser.displayName} attempted to upload as invalid DJ ID: ${selectedDjId}`);
          return res.status(400).json({
            success: false,
            error: 'Invalid DJ selected'
          });
        }
      }
      
      // Check if we have all required metadata
      if (!metadata.broadcastDate || !metadata.title) {
        return res.status(400).json({
          success: false,
          error: 'Invalid metadata',
          message: 'Missing required metadata fields'
        });
      }
      
      // Check if we have all required files
      if (!fileBuffers.audio || !fileBuffers.artwork || !fileBuffers.songlist) {
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
      
      // Save each buffered file
      for (const [name, fileData] of Object.entries(fileBuffers)) {
        if (!fileData.buffer || !fileData.info) {
          logParserEvent('UploadRoutes', ParserLogType.WARNING, `Missing buffer or info for file: ${name}`);
          continue;
        }
        let saveTo;
        if (name === 'audio') {
          const ext = path.extname(fileData.info.filename) || '.mp3';
          saveTo = path.join(fileDir, `${normalizedBase}${ext}`);
        } else if (name === 'songlist') {
          const ext = path.extname(fileData.info.filename);
          saveTo = path.join(fileDir, `${normalizedBase}${ext}`);
        } else if (name === 'artwork') {
          const ext = path.extname(fileData.info.filename) || '.jpg';
          saveTo = path.join(fileDir, `${normalizedBase}${ext}`);
          metadata.artworkFilename = `${normalizedBase}${ext}`;
        } else {
          logParserEvent('UploadRoutes', ParserLogType.WARNING, `Skipping unknown file type: ${name}`);
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
      
      // Return file ID to client with 'received' status
      res.json({
        success: true,
        fileId: fileId,
        status: 'received',
        message: 'Files successfully received and validated'
      });
    });
    
    // Handle errors
    bb.on('error', (err: Error) => {
      logParserEvent('UploadRoutes', ParserLogType.ERROR, `File receiving error:`, err);
      res.status(500).json({
        success: false,
        error: 'File receiving failed',
        message: err.message
      });
    });
    
    // Pipe request to busboy
    req.pipe(bb);
  } catch (err) {
    logParserEvent('UploadRoutes', ParserLogType.ERROR, `Error in upload:`, err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

export default router;
