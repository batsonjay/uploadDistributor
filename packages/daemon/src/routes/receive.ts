// Use require for express and busboy to avoid TypeScript import issues
const express = require('express');
const busboy = require('busboy');
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
// Ensure TypeScript can find the uuid module
import { fork } from 'child_process';
import { anyAuthenticated } from '../middleware/roleVerification';

const router = express.Router();

// Get uploads directory from environment or use default
const uploadsDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Receive endpoint - handles files sent from clients to the daemon
 * @route POST /upload
 * @param {object} req.body.metadata - File metadata
 * @param {file} req.files.audio - Audio file
 * @param {file} req.files.songlist - Songlist file
 * @returns {object} 200 - File ID and status
 */
router.post('/', anyAuthenticated, (req: any, res: any) => {
  // Get file ID from request or generate a new one
  // This allows tests to reuse the same ID
  const fileId = req.headers['x-upload-id'] || uuidv4();
  
  // Create directory for this file set
  const fileDir = path.join(uploadsDir, fileId as string);
  
  // If directory exists, clean it up for reuse
  if (fs.existsSync(fileDir)) {
    console.log(`Reusing existing directory for ${fileId}`);
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
  const metadata = {
    userId: (req.user?.id || ''),
    title: '',
    djName: '',
    azcFolder: '',
    azcPlaylist: '',
    userRole: (req.user?.role || ''),
    destinations: 'azuracast,mixcloud,soundcloud' // Default to all destinations
  };
  
  // Set up busboy to handle file receiving
  const bb = busboy({ headers: req.headers });
  
  // Handle file receiving
  bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
    const { filename, encoding, mimeType } = info;
    console.log(`Processing ${name} file: ${filename}, encoding: ${encoding}, mimeType: ${mimeType}`);
    
    const saveTo = path.join(fileDir, name === 'audio' ? 'audio.mp3' : 'songlist.txt');
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
  bb.on('finish', async () => {
    // Save metadata
    fs.writeFileSync(
      path.join(fileDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Add a small delay to ensure files are fully written to disk
    console.log('Adding a small delay to ensure files are fully written to disk...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Validate files before proceeding
    const audioFilePath = path.join(fileDir, 'audio.mp3');
    const songlistFilePath = path.join(fileDir, 'songlist.txt');
    
    // Check if files exist and have content
    console.log(`Checking audio file at path: ${audioFilePath}`);
    
    if (!fs.existsSync(audioFilePath)) {
      console.log(`Audio file does not exist at path: ${audioFilePath}`);
      return res.status(400).json({
        error: 'Invalid file',
        message: 'Audio file is missing'
      });
    }
    
    const audioFileSize = fs.statSync(audioFilePath).size;
    console.log(`Audio file exists and has size: ${audioFileSize} bytes`);
    
    if (audioFileSize === 0) {
      console.log(`Audio file is empty (0 bytes)`);
      return res.status(400).json({
        error: 'Invalid file',
        message: 'Audio file is empty'
      });
    }
    
    // Try to read the first few bytes of the file to verify it's readable
    try {
      const fd = fs.openSync(audioFilePath, 'r');
      const buffer = Buffer.alloc(10);
      const bytesRead = fs.readSync(fd, buffer, 0, 10, 0);
      fs.closeSync(fd);
      
      console.log(`Read ${bytesRead} bytes from audio file: ${buffer.toString('hex')}`);
      
      if (bytesRead === 0) {
        console.log(`Could not read any bytes from audio file`);
        return res.status(400).json({
          error: 'Invalid file',
          message: 'Could not read audio file'
        });
      }
    } catch (err) {
      console.error(`Error reading audio file: ${err}`);
      return res.status(400).json({
        error: 'Invalid file',
        message: `Error reading audio file: ${(err as Error).message}`
      });
    }
    
    if (!fs.existsSync(songlistFilePath)) {
      return res.status(400).json({
        error: 'Invalid file',
        message: 'Songlist file is missing'
      });
    }
    
    if (fs.statSync(songlistFilePath).size === 0) {
      return res.status(400).json({
        error: 'Invalid file',
        message: 'Songlist file is empty'
      });
    }
    
    console.log(`Songlist file exists and has size: ${fs.statSync(songlistFilePath).size} bytes`);
    
    // Create initial status file with 'received' status
    fs.writeFileSync(
      path.join(fileDir, 'status.json'),
      JSON.stringify({
        status: 'received',
        message: 'Files successfully received and validated',
        timestamp: new Date().toISOString()
      }, null, 2)
    );
    
    // Determine if we're in development mode
    // When using ts-node-dev, we're definitely in development mode
    const isDev = true;
    
    // Use .ts extension in development mode, .js in production
    const fileExt = isDev ? '.ts' : '.js';
    
    // Fork a process to handle the upload to destinations
    const processorPath = path.join(__dirname, `../processors/upload-processor${fileExt}`);
    console.log(`Forking process for received files ${fileId} using ${processorPath}`);
    
    try {
      // In development mode, we need to use ts-node to execute TypeScript files
      let child;
      if (isDev) {
        // For development mode, use the child_process.spawn method with ts-node
        const { spawn } = require('child_process');
        console.log(`Spawning ts-node process for ${processorPath} with file ID ${fileId}`);
        
        // Use spawn instead of fork for better control
        child = spawn('npx', ['ts-node', processorPath, fileId], {
          stdio: 'inherit', // Inherit stdio to see output in parent process
          detached: false   // Keep the child process attached to the parent
        });
      } else {
        // For production mode, use the compiled JS file directly
        child = fork(processorPath, [fileId]);
      }
      
      // Log when child process exits
      child.on('exit', (code: number | null) => {
        console.log(`Child process for file ID ${fileId} exited with code ${code}`);
      });
      
      // We don't need to wait for the child process or communicate with it
      console.log(`Forked process for file ID ${fileId}`);
    } catch (err) {
      console.error(`Error forking process for file ID ${fileId}:`, err);
      // We still return success to the client, as the files were received
      // The status endpoint will show any processing errors
    }
    
    // Return file ID to client with 'received' status
    res.json({
      uploadId: fileId, // Keep uploadId in the response for backward compatibility
      status: 'received',
      message: 'Files successfully received and validated'
    });
  });
  
  // Handle errors
  bb.on('error', (err: Error) => {
    console.error('File receiving error:', err);
    res.status(500).json({
      error: 'File receiving failed',
      message: err.message
    });
  });
  
  // Pipe request to busboy
  req.pipe(bb);
});

export { router as receiveRoutes };
