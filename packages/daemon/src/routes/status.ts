import express from 'express';
import * as path from 'path';
import * as fs from 'fs';

const router = express.Router();

// Path to uploads directory
const uploadsDir = path.join(__dirname, '../../uploads');

/**
 * Status endpoint
 * @route GET /status/:uploadId
 * @param {string} req.params.uploadId - Upload ID
 * @returns {object} 200 - Upload status
 */
router.get('/:uploadId', (req, res) => {
  const { uploadId } = req.params;
  
  // Check if upload directory exists
  const uploadDir = path.join(uploadsDir, uploadId);
  if (!fs.existsSync(uploadDir)) {
    return res.status(404).json({
      error: 'Upload not found',
      message: `No upload found with ID ${uploadId}`
    });
  }
  
  // Check if status file exists
  const statusFile = path.join(uploadDir, 'status.json');
  if (fs.existsSync(statusFile)) {
    try {
      const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      
      // Get metadata if available
      let metadata: Record<string, any> = {};
      const metadataFile = path.join(uploadDir, 'metadata.json');
      if (fs.existsSync(metadataFile)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
        } catch (err) {
          console.error('Error reading metadata file:', err);
        }
      }
      
      // Get file information
      const files: Record<string, any> = {};
      const audioFile = path.join(uploadDir, 'audio.mp3');
      const songlistFile = path.join(uploadDir, 'songlist.txt');
      
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
        uploadId,
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
    uploadId,
    status: 'queued',
    message: 'Upload is queued for processing'
  });
});

export { router as statusRoutes };
