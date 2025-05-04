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
      return res.json({
        uploadId,
        ...status
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
