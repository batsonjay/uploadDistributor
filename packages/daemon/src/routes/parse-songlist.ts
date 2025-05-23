import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import busboy from 'busboy';
import { v4 as uuidv4 } from 'uuid';
import { anyAuthenticated } from '../middleware/roleVerification.js';
import { SonglistParserService } from '../services/SonglistParserService.js';
import { logDestinationStatus, LogType } from '../utils/LoggingUtils.js';

const router = express.Router();

// Get received files directory from environment or use default
const receivedFilesDir = process.env.RECEIVED_FILES_DIR || path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '../../received-files'
).replace(/^\/([A-Za-z]):/, "$1:"); // Fix Windows paths

/**
 * Validate a songlist file without saving other files
 * @route POST /parse-songlist/validate
 * @param {file} req.files.songlist - Songlist file
 * @param {object} req.body.metadata - Metadata for the songlist
 * @returns {object} 200 - Parsed songs array
 */
router.post('/validate', anyAuthenticated, async (req: express.Request, res: express.Response) => {
  try {
    // Get the authenticated user from the request
    const authUser = (req as any).user;
    
    // Generate a temporary file ID
    const tempFileId = uuidv4();
    
    // Create temporary directory for this file
    const tempDir = path.join(receivedFilesDir, tempFileId);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Initialize metadata object
    let metadata: Record<string, any> = {};
    
    // Set up busboy to handle file receiving
    const bb = busboy({ headers: req.headers });
    
    // Track if we've received a songlist file
    let songlistReceived = false;
    let songlistPath = '';
    
    // Handle file receiving
    bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
      if (name === 'songlist') {
        songlistReceived = true;
        const ext = path.extname(info.filename);
        songlistPath = path.join(tempDir, `songlist${ext}`);
        
        // Write the file directly to disk
        const writeStream = fs.createWriteStream(songlistPath);
        file.pipe(writeStream);
      } else {
        // Ignore other files
        file.resume();
      }
    });
    
    // Handle metadata fields
    bb.on('field', (name: string, val: string) => {
      try {
        if (name === 'metadata') {
          metadata = JSON.parse(val);
        }
      } catch (err) {
        logDestinationStatus('ParseSonglist', LogType.ERROR, tempFileId, `Error parsing metadata: ${err}`);
      }
    });
    
    // Handle completion
    bb.on('finish', async () => {
      // Check if we received a songlist file
      if (!songlistReceived || !songlistPath) {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        return res.status(400).json({
          success: false,
          error: 'Missing songlist file',
          message: 'Songlist file is required'
        });
      }
      
      try {
        // Parse the songlist using the service
        const result = await SonglistParserService.parse(songlistPath);
        const songs = result.songs;
        
        // Clean up temporary directory
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        // Return the parsed songs
        res.json({
          success: true,
          songs: songs
        });
      } catch (err) {
        // Clean up temporary directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        logDestinationStatus('ParseSonglist', LogType.ERROR, tempFileId, `Error parsing songlist: ${err}`);
        res.status(500).json({
          success: false,
          error: 'Parse failed',
          message: err instanceof Error ? err.message : 'Failed to parse songlist'
        });
      }
    });
    
    // Handle errors
    bb.on('error', (err: Error) => {
      // Clean up temporary directory
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      
      logDestinationStatus('ParseSonglist', LogType.ERROR, tempFileId, `File receiving error: ${err}`);
      res.status(500).json({
        success: false,
        error: 'File receiving failed',
        message: err.message
      });
    });
    
    // Pipe request to busboy
    req.pipe(bb);
  } catch (err) {
    logDestinationStatus('ParseSonglist', LogType.ERROR, 'validate', `Error in validate endpoint: ${err}`);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error'
    });
  }
});

/**
 * Get parsed songs for a specific file ID
 * @route GET /parse-songlist/:fileId
 * @returns {object} 200 - Parsed songs array
 */
router.get('/:fileId', anyAuthenticated, async (req: express.Request, res: express.Response) => {
  const fileId = req.params.fileId;
  if (!fileId) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'File ID is required'
    });
  }
  const fileDir = path.join(receivedFilesDir, fileId);

  try {
    // Check if directory exists
    if (!fs.existsSync(fileDir)) {
      return res.status(404).json({
        error: 'Not found',
        message: 'File ID not found'
      });
    }

    // Load metadata
    const metadata = JSON.parse(fs.readFileSync(path.join(fileDir, 'metadata.json'), 'utf8'));
    const normalizedBase = `${metadata.broadcastDate}_${metadata.djName.replace(/\s+/g, '_')}_${metadata.title.replace(/\s+/g, '_')}`;
    
    // Find the songlist file by checking for all supported extensions
    let songlistPath = '';
    const possibleExtensions = ['.txt', '.rtf', '.docx', '.nml', '.m3u8'];
    for (const ext of possibleExtensions) {
      const testPath = path.join(fileDir, `${normalizedBase}${ext}`);
      if (fs.existsSync(testPath)) {
        songlistPath = testPath;
        break;
      }
    }

    if (!songlistPath) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Songlist file not found'
      });
    }

    // Parse the songlist using the service
    const result = await SonglistParserService.parse(songlistPath);
    const songs = result.songs;

    // Store the parsed songs
    const normalizedFilename = `${metadata.broadcastDate}_${metadata.djName.replace(/\s+/g, '_')}_${metadata.title.replace(/\s+/g, '_')}_Songs.json`;
    
    fs.writeFileSync(
      path.join(fileDir, normalizedFilename),
      JSON.stringify(songs, null, 2)
    );

    res.json({ songs });
  } catch (err) {
    logDestinationStatus('ParseSonglist', LogType.ERROR, fileId, `Error parsing songlist: ${err}`);
    res.status(500).json({
      error: 'Parse failed',
      message: err instanceof Error ? err.message : 'Failed to parse songlist'
    });
  }
});

/**
 * Confirm parsed songs for a specific file ID
 * @route POST /parse-songlist/:fileId/confirm
 * @returns {object} 200 - Success status
 */
router.post('/:fileId/confirm', anyAuthenticated, async (req: express.Request, res: express.Response) => {
  console.log('=== CONFIRM ENDPOINT CALLED ===');
  console.log('Request headers:', req.headers);
  console.log('Request params:', req.params);
  console.log('Request body:', req.body);
  
  const fileId = req.params.fileId;
  if (!fileId) {
    console.log('ERROR: File ID is required but not provided');
    return res.status(400).json({
      error: 'Bad request',
      message: 'File ID is required'
    });
  }
  const { songs } = req.body;
  console.log(`Songs received: ${songs ? songs.length : 0}`);
  
  const fileDir = path.join(receivedFilesDir, fileId);
  console.log(`Looking for file directory: ${fileDir}`);

  try {
    // Check if directory exists
    if (!fs.existsSync(fileDir)) {
      console.log(`ERROR: File directory not found: ${fileDir}`);
      return res.status(404).json({
        error: 'Not found',
        message: 'File ID not found'
      });
    }
    console.log(`File directory found: ${fileDir}`);

    // Read metadata to get the normalized filename
    const metadata = JSON.parse(fs.readFileSync(path.join(fileDir, 'metadata.json'), 'utf8'));
    const normalizedFilename = `${metadata.broadcastDate}_${metadata.djName.replace(/\s+/g, '_')}_${metadata.title.replace(/\s+/g, '_')}_Songs.json`;
    
    // Store the confirmed songs
    fs.writeFileSync(
      path.join(fileDir, normalizedFilename),
      JSON.stringify(songs, null, 2)
    );

    // Update status
    fs.writeFileSync(
      path.join(fileDir, 'status.json'),
      JSON.stringify({
        status: 'songs_confirmed',
        message: 'Songs have been validated and confirmed',
        timestamp: new Date().toISOString()
      }, null, 2)
    );

    // Start worker thread to process the file
    const { Worker } = await import('node:worker_threads');
    const workerPath = new URL('../processors/file-processor-worker.js', import.meta.url).pathname;
    console.log(`Worker path: ${workerPath}`);

    logDestinationStatus('ParseSonglist', LogType.INFO, fileId, `Launching worker thread`);
    console.log(`Launching worker thread for file ID: ${fileId}`);
    
    try {
      const worker = new Worker(workerPath, {
        workerData: fileId
      });

      worker.on('message', (msg) => {
        console.log(`Worker message received: ${JSON.stringify(msg)}`);
        logDestinationStatus('ParseSonglist', LogType.INFO, fileId, `Worker completed: ${JSON.stringify(msg)}`);
      });

      worker.on('error', (err) => {
        console.error(`Worker error: ${err}`);
        logDestinationStatus('ParseSonglist', LogType.ERROR, fileId, `Worker error: ${err}`);
      });

      worker.on('exit', (code) => {
        console.log(`Worker exited with code ${code}`);
        logDestinationStatus('ParseSonglist', LogType.INFO, fileId, `Worker exited with code ${code}`);
      });
      
      console.log('Worker thread started successfully');
    } catch (workerErr) {
      console.error(`Failed to start worker thread: ${workerErr}`);
      logDestinationStatus('ParseSonglist', LogType.ERROR, fileId, `Failed to start worker thread: ${workerErr}`);
      return res.status(500).json({
        error: 'Worker thread error',
        message: `Failed to start worker thread: ${workerErr instanceof Error ? workerErr.message : String(workerErr)}`
      });
    }

    res.json({
      status: 'success',
      message: 'Songs confirmed successfully'
    });
  } catch (err) {
    console.error(`Error in confirm endpoint: ${err}`);
    logDestinationStatus('ParseSonglist', LogType.ERROR, fileId, `Error confirming songs: ${err}`);
    res.status(500).json({
      error: 'Confirmation failed',
      message: err instanceof Error ? err.message : 'Failed to confirm songs'
    });
  }
});

export { router as parseSonglistRoutes };
