import express, { Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { anyAuthenticated } from '../middleware/roleVerification';

const router = express.Router();

// Path to uploads directory
const uploadsDir = path.join(__dirname, '../../uploads');

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
  
  // Check if file directory exists
  const fileDir = path.join(uploadsDir, fileId);
  if (!fs.existsSync(fileDir)) {
    return res.status(404).json({
      error: 'File not found',
      message: `No file found with ID ${fileId}`
    });
  }
  
  // Check if status file exists
  const statusFile = path.join(fileDir, 'status.json');
  if (fs.existsSync(statusFile)) {
    try {
      const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      
      // Get metadata if available
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
