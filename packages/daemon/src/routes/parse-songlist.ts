import express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { anyAuthenticated } from '../middleware/roleVerification.js';
import { SonglistParserService } from '../services/SonglistParserService.js';

const router = express.Router();

// Get received files directory from environment or use default
const receivedFilesDir = process.env.RECEIVED_FILES_DIR || path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '../../received-files'
).replace(/^\/([A-Za-z]):/, "$1:"); // Fix Windows paths

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
    console.error('Error parsing songlist:', err);
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
  const fileId = req.params.fileId;
  if (!fileId) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'File ID is required'
    });
  }
  const { songs } = req.body;
  const fileDir = path.join(receivedFilesDir, fileId);

  try {
    // Check if directory exists
    if (!fs.existsSync(fileDir)) {
      return res.status(404).json({
        error: 'Not found',
        message: 'File ID not found'
      });
    }

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

    console.log(`Launching worker with fileId: ${fileId}`);
    const worker = new Worker(workerPath, {
      workerData: fileId
    });

    worker.on('message', (msg) => {
      console.log(`Worker completed for ${fileId}:`, msg);
    });

    worker.on('error', (err) => {
      console.error(`Worker error for ${fileId}:`, err);
    });

    worker.on('exit', (code) => {
      console.log(`Worker exited for ${fileId} with code ${code}`);
    });

    res.json({
      status: 'success',
      message: 'Songs confirmed successfully'
    });
  } catch (err) {
    console.error('Error confirming songs:', err);
    res.status(500).json({
      error: 'Confirmation failed',
      message: err instanceof Error ? err.message : 'Failed to confirm songs'
    });
  }
});

export { router as parseSonglistRoutes };
