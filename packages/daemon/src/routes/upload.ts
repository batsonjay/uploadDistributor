// Use require for express and busboy to avoid TypeScript import issues
const express = require('express');
const busboy = require('busboy');
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
// Ensure TypeScript can find the uuid module
import { fork } from 'child_process';

const router = express.Router();

// Get uploads directory from environment or use default
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Create uploads directory if it doesn't exist
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
router.post('/', (req: any, res: any) => {
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
  bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
    const { filename, encoding, mimeType } = info;
    console.log(`Processing ${name} file: ${filename}, encoding: ${encoding}, mimeType: ${mimeType}`);
    
    const saveTo = path.join(uploadDir, name === 'audio' ? 'audio.mp3' : 'songlist.txt');
    file.pipe(fs.createWriteStream(saveTo));
  });
  
  // Handle metadata fields
  bb.on('field', (name: string, val: string) => {
    if (name in metadata) {
      // Type assertion to ensure TypeScript knows this is a valid key
      (metadata as Record<string, string>)[name] = val;
    }
  });
  
  // Handle completion
  bb.on('finish', () => {
    // Save metadata
    fs.writeFileSync(
      path.join(uploadDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Create initial status file
    fs.writeFileSync(
      path.join(uploadDir, 'status.json'),
      JSON.stringify({
        status: 'queued',
        message: 'Upload received and queued for processing',
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    
    // Fork a process to handle the upload
    const processorPath = path.join(__dirname, '../processors/upload-processor.js');
    console.log(`Forking process for upload ${uploadId}`);
    
    try {
      const child = fork(processorPath, [uploadId]);
      
      // Log when child process exits
      child.on('exit', (code) => {
        console.log(`Child process for upload ${uploadId} exited with code ${code}`);
      });
      
      // We don't need to wait for the child process or communicate with it
      console.log(`Forked process for upload ${uploadId}`);
    } catch (err) {
      console.error(`Error forking process for upload ${uploadId}:`, err);
      // We still return success to the client, as the upload was received
      // The status endpoint will show any processing errors
    }
    
    // Return upload ID to client
    res.json({
      uploadId,
      status: 'queued'
    });
  });
  
  // Handle errors
  bb.on('error', (err: Error) => {
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
