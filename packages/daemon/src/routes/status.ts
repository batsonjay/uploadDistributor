import express, { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as glob from 'glob';
import { anyAuthenticated } from '../middleware/roleVerification.js';
import { FileManager } from '../services/FileManager.js';

const router = express.Router();

// Initialize FileManager
const fileManager = new FileManager();

// Path to received files directory
const receivedFilesDir = fileManager.getReceivedFilesDir();
const archiveDir = fileManager.getArchiveDir();

/**
 * Status endpoint
 * @route GET /status/:fileId
 * @param {string} req.params.fileId - File ID
 * @returns {object} 200 - File status
 */
router.get('/:fileId', anyAuthenticated, (req: Request, res: Response) => {
  const { fileId } = req.params;
  
  if (!fileId) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'File ID is required'
    });
  }
  
  // First check if file directory exists in received-files
  const fileDir = path.join(receivedFilesDir, fileId);
  let statusFile = path.join(fileDir, 'status.json');
  let isArchived = false;
  let archiveStatusFile = '';
  
  // If the original directory doesn't exist, check if it's been archived
  if (!fs.existsSync(fileDir)) {
    console.log(`Original file directory not found: ${fileDir}, checking archive...`);
    
    // Search for status file in archive directory with the fileId in the content
    try {
      // Use glob to find all status files in the archive directory
      const globPattern = path.join(archiveDir, '**', '*_status.json');
      console.log(`Searching for archived status files with pattern: ${globPattern}`);
      
      const statusFiles = glob.sync(globPattern);
      console.log(`Found ${statusFiles.length} status files in archive`);
      
      // Track all matching status files by timestamp
      const matchingStatusFiles: { file: string; timestamp: string }[] = [];
      
      // Check each status file for the fileId
      for (const file of statusFiles) {
        try {
          console.log(`Checking archive status file: ${file}`);
          const content = fs.readFileSync(file, 'utf8');
          const status = JSON.parse(content);
          
          console.log(`Status file contains fileId: ${status.fileId}, looking for: ${fileId}`);
          
          // If this status file contains our fileId, add it to matching files
          if (status.fileId === fileId && status.timestamp) {
            matchingStatusFiles.push({
              file,
              timestamp: status.timestamp
            });
            console.log(`Found matching archived status file: ${file} with timestamp ${status.timestamp}`);
          }
        } catch (err) {
          console.error(`Error reading archive status file ${file}:`, err);
        }
      }
      
      // If we found matching files, use the most recent one
      if (matchingStatusFiles.length > 0) {
        // Sort by timestamp descending (newest first)
        matchingStatusFiles.sort((a, b) => {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        
        // Get the most recent file (we know it exists because we checked length > 0)
        // Using non-null assertion because we've already checked matchingStatusFiles.length > 0
        const mostRecentMatch = matchingStatusFiles[0]!;
        archiveStatusFile = mostRecentMatch.file;
        isArchived = true;
        console.log(`Using most recent archived status file: ${archiveStatusFile} with timestamp ${mostRecentMatch.timestamp}`);
        
        // Check if the timestamp is recent (within the last hour)
        const timestampDate = new Date(mostRecentMatch.timestamp);
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        
        if (timestampDate < oneHourAgo) {
          console.log(`Warning: Using archived status file with old timestamp: ${mostRecentMatch.timestamp}`);
        }
      } else {
        // If we didn't find the file in the archive, return 404
        console.log(`File not found in archive: ${fileId}`);
        return res.status(404).json({
          error: 'File not found',
          message: `No file found with ID ${fileId}`
        });
      }
    } catch (err) {
      console.error('Error searching archive directory:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Could not search archive directory'
      });
    }
  }
  
  // Check if status file exists (either in original location or archive)
  if ((fs.existsSync(statusFile) && !isArchived) || (isArchived && archiveStatusFile)) {
    try {
      // Read the appropriate status file
      const status = JSON.parse(fs.readFileSync(isArchived ? archiveStatusFile : statusFile, 'utf8'));
      
      // If the file is archived, we don't need to get additional metadata or file info
      // as it should already be in the status object
      if (isArchived) {
        console.log(`Returning archived status for file: ${fileId}`);
        console.log(`Archive path: ${path.dirname(archiveStatusFile)}`);
        
        // Add archive information to the response
        return res.json({
          fileId,
          ...status,
          archived: true,
          archivePath: path.dirname(archiveStatusFile)
        });
      }
      
      // For non-archived files, get metadata and file info as before
      let metadata: Record<string, any> = {};
      const metadataFile = path.join(fileDir, 'metadata.json');
      if (fs.existsSync(metadataFile)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        } catch (err) {
          console.error('Error reading metadata file:', err);
        }
      }
      
      // Get file information
      const files: Record<string, any> = {};
      const audioFile = path.join(fileDir, 'audio.mp3');
      const songlistFile = path.join(fileDir, 'songlist.txt');
      
      if (fs.existsSync(audioFile)) {
        const audioStats = fs.statSync(audioFile);
        files['audio'] = {
          size: audioStats.size,
          exists: true
        };
      } else {
        files['audio'] = { exists: false };
      }
      
      if (fs.existsSync(songlistFile)) {
        const songlistStats = fs.statSync(songlistFile);
        const songlistContent = fs.readFileSync(songlistFile, 'utf8');
        const songCount = songlistContent.split('\n').filter(line => line.trim()).length;
        
        files['songlist'] = {
          size: songlistStats.size,
          exists: true,
          songCount
        };
      } else {
        files['songlist'] = { exists: false };
      }
      
      return res.json({
        fileId,
        ...status,
        metadata,
        files
      });
    } catch (err) {
      console.error('Error reading status file:', err);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Could not read upload status'
      });
    }
  }
  
  // If no status file, assume it's still queued
  return res.json({
    fileId,
    status: 'queued',
    message: 'Files are queued for processing'
  });
});

export { router as statusRoutes };
