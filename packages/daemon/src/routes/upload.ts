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
  // Get upload ID from request or generate a new one
  // This allows tests to reuse the same upload ID
  const uploadId = req.headers['x-upload-id'] || uuidv4();
  
  // Create directory for this upload
  const uploadDir = path.join(uploadsDir, uploadId as string);
  
  // If directory exists, clean it up for reuse
  if (fs.existsSync(uploadDir)) {
    console.log(`Reusing existing upload directory for ${uploadId}`);
    // Keep the directory but remove any existing files
    const files = fs.readdirSync(uploadDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(uploadDir, file));
    });
  } else {
    // Create new directory
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  
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
    
    // Determine if we're in development mode
    // When using ts-node-dev, we're definitely in development mode
    const isDev = true;
    
    // Use .ts extension in development mode, .js in production
    const fileExt = isDev ? '.ts' : '.js';
    
    // Fork a process to handle the upload
    const processorPath = path.join(__dirname, `../processors/upload-processor${fileExt}`);
    console.log(`Forking process for upload ${uploadId} using ${processorPath}`);
    
    try {
      // In development mode, we need to use ts-node to execute TypeScript files
      let child;
      if (isDev) {
        // For development mode, use the child_process.spawn method with ts-node
        const { spawn } = require('child_process');
        console.log(`Spawning ts-node process for ${processorPath} with upload ID ${uploadId}`);
        
        // Use spawn instead of fork for better control
        child = spawn('npx', ['ts-node', processorPath, uploadId], {
          stdio: 'inherit', // Inherit stdio to see output in parent process
          detached: false   // Keep the child process attached to the parent
        });
      } else {
        // For production mode, use the compiled JS file directly
        child = fork(processorPath, [uploadId]);
      }
      
      // Log when child process exits
      child.on('exit', (code: number | null) => {
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
