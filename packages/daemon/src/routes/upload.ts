import express from 'express';
import * as busboy from 'busboy';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Upload endpoint
 * @route POST /upload
 * @param {object} req.body.metadata - Upload metadata
 * @param {file} req.files.audio - Audio file
 * @param {file} req.files.songlist - Songlist file
 * @returns {object} 200 - Upload ID and status
 */
router.post('/', (req, res) => {
  // Generate unique upload ID
  const uploadId = uuidv4();
  
  // Create directory for this upload
  const uploadDir = path.join(uploadsDir, uploadId);
  fs.mkdirSync(uploadDir, { recursive: true });
  
  // Initialize metadata object
  const metadata = {
    userId: '',
    title: '',
    djName: '',
    azcFolder: '',
    azcPlaylist: ''
  };
  
  // Set up busboy to handle file uploads
  const bb = busboy({ headers: req.headers });
  
  // Handle file uploads
  bb.on('file', (name, file, info) => {
    const { filename, encoding, mimeType } = info;
    console.log(`Processing ${name} file: ${filename}, encoding: ${encoding}, mimeType: ${mimeType}`);
    
    const saveTo = path.join(uploadDir, name === 'audio' ? 'audio.mp3' : 'songlist.txt');
    file.pipe(fs.createWriteStream(saveTo));
  });
  
  // Handle metadata fields
  bb.on('field', (name, val) => {
    if (name in metadata) {
      metadata[name] = val;
    }
  });
  
  // Handle completion
  bb.on('finish', () => {
    // Save metadata
    fs.writeFileSync(
      path.join(uploadDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Fork a process to handle the upload
    // This would be implemented in a real system
    
    // Return upload ID to client
    res.json({
      uploadId,
      status: 'queued'
    });
  });
  
  // Handle errors
  bb.on('error', (err) => {
    console.error('Upload error:', err);
    res.status(500).json({
      error: 'Upload failed',
      message: err.message
    });
  });
  
  // Pipe request to busboy
  req.pipe(bb);
});

export { router as uploadRoutes };
