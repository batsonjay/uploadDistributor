import express from 'express';
import busboy from 'busboy';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { fork, spawn } from 'child_process';
import { anyAuthenticated } from '../middleware/roleVerification.js';

const router = express.Router();

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
 * Receive endpoint - handles files sent from clients to the daemon
 * @route POST /receive
 * @param {object} req.body.metadata - File metadata
 * @param {file} req.files.audio - Audio file
 * @param {file} req.files.songlist - Songlist file
 * @returns {object} 200 - File ID and status
 */
router.post('/', anyAuthenticated, (req: any, res: any) => {
  // Get file ID from request or generate a new one
  // This allows tests to reuse the same ID
  const fileId = req.headers['x-file-id'] || uuidv4();
  
  // Create directory for this file set
  const fileDir = path.join(receivedFilesDir, fileId as string);
  
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
    broadcastDate: '',
    broadcastTime: '',
    genre: '',
    description: '',
    azcFolder: '',
    azcPlaylist: '',
    userRole: (req.user?.role || ''),
    destinations: 'azuracast,mixcloud,soundcloud', // Default to all destinations
    artworkFilename: '' // Store the artwork filename
  };
  
  // Set up busboy to handle file receiving
  const bb = busboy({ headers: req.headers });
  
  // Buffer to store files until we have metadata
  const fileBuffers: { [key: string]: { buffer: Buffer[], info: any } } = {};

  // Handle file receiving
  bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
    const { filename, encoding, mimeType } = info;
    console.log(`Processing ${name} file: ${filename}, encoding: ${encoding}, mimeType: ${mimeType}`);
    
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
    if (name in metadata) {
      // Type assertion to ensure TypeScript knows this is a valid key
      (metadata as Record<string, string>)[name] = val;
    }
  });
  
  // Handle completion
  bb.on('finish', async () => {
    // Check if we have all required metadata
    if (!metadata.broadcastDate || !metadata.djName || !metadata.title) {
      return res.status(400).json({
        error: 'Invalid metadata',
        message: 'Missing required metadata fields'
      });
    }

    // Now that we have metadata, save the buffered files
    const normalizedBase = `${metadata.broadcastDate}_${metadata.djName.replace(/\s+/g, '_')}_${metadata.title.replace(/\s+/g, '_')}`;

    // Save each buffered file
    for (const [name, fileData] of Object.entries(fileBuffers)) {
      if (!fileData.buffer || !fileData.info) {
        console.log(`Missing buffer or info for file: ${name}`);
        continue;
      }
      let saveTo;
      if (name === 'audio') {
        saveTo = path.join(fileDir, `${normalizedBase}.mp3`);
      } else if (name === 'songlist') {
        const ext = path.extname(fileData.info.filename);
        saveTo = path.join(fileDir, `${normalizedBase}${ext}`);
      } else if (name === 'artwork') {
        const ext = path.extname(fileData.info.filename) || '.jpg';
        saveTo = path.join(fileDir, `${normalizedBase}${ext}`);
        metadata.artworkFilename = `${normalizedBase}${ext}`;
      } else {
        console.log(`Skipping unknown file type: ${name}`);
        continue;
      }

      // Write the buffered file to disk
      fs.writeFileSync(saveTo, Buffer.concat(fileData.buffer));
    }

    // Save metadata
    fs.writeFileSync(
      path.join(fileDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Add a small delay to ensure files are fully written to disk
    console.log('Adding a small delay to ensure files are fully written to disk...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Validate files before proceeding
    const audioFilePath = path.join(fileDir, `${normalizedBase}.mp3`);
    // Find the songlist file by checking for all supported extensions
    let songlistFilePath = '';
    const possibleExtensions = ['.txt', '.rtf', '.docx', '.nml', '.m3u8'];
    for (const ext of possibleExtensions) {
      const testPath = path.join(fileDir, `${normalizedBase}${ext}`);
      if (fs.existsSync(testPath)) {
        songlistFilePath = testPath;
        break;
      }
    }
    
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
    
    // Check for artwork file
    const artworkFilePath = path.join(fileDir, metadata.artworkFilename || `${normalizedBase}.jpg`);
    
    if (!fs.existsSync(artworkFilePath)) {
      console.log(`Artwork file does not exist at path: ${artworkFilePath}`);
      return res.status(400).json({
        error: 'Invalid file',
        message: 'Artwork file is missing'
      });
    }
    
    if (fs.statSync(artworkFilePath).size === 0) {
      console.log(`Artwork file is empty (0 bytes)`);
      return res.status(400).json({
        error: 'Invalid file',
        message: 'Artwork file is empty'
      });
    }
    
    console.log(`Artwork file exists and has size: ${fs.statSync(artworkFilePath).size} bytes`);
    
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
    
    // Worker-based processing now happens after confirmation, so no fork/spawn here
    
    // Return file ID to client with 'received' status
    res.json({
      fileId: fileId,
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
