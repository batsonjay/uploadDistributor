import express, { Request, Response } from 'express';
import busboy from 'busboy';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { parseSonglist, ParseResult } from '@uploadDistributor/songlist-parser';
import { anyAuthenticated } from '../middleware/roleVerification.js';

const router = express.Router();

/**
 * Parse songlist endpoint - handles songlist file parsing
 * @route POST /parse-songlist
 * @param {file} req.files.songlist - Songlist file to parse
 * @returns {object} 200 - Parsed songlist data
 */
router.post('/', anyAuthenticated, (req: Request, res: Response) => {
  const fileId = uuidv4();
  const tempDir = path.join(process.cwd(), 'temp', fileId);
  
  try {
    // Create temp directory
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Set up busboy to handle file receiving
    const bb = busboy({ headers: req.headers });
    let songlistPath: string | null = null;
    
    // Handle file receiving
    bb.on('file', (name: string, file: NodeJS.ReadableStream, info: { filename: string }) => {
      if (name === 'songlist') {
        // Save file with original extension
        const ext = path.extname(info.filename);
        songlistPath = path.join(tempDir, `songlist${ext}`);
        file.pipe(fs.createWriteStream(songlistPath));
      }
    });
    
    // Handle completion
    bb.on('finish', async () => {
      try {
        if (!songlistPath) {
          throw new Error('No songlist file received');
        }
        
        // Parse the songlist
        const parseResult: ParseResult = await parseSonglist(songlistPath);
        
        // Clean up temp files
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        // Return the parse result
        res.json(parseResult);
        
      } catch (err) {
        // Clean up temp files
        if (tempDir) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
        
        res.status(400).json({
          error: 'Parse failed',
          message: (err as Error).message
        });
      }
    });
    
    // Handle errors
    bb.on('error', (err: Error) => {
      // Clean up temp files
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
      
      res.status(500).json({
        error: 'File receiving failed',
        message: err.message
      });
    });
    
    // Pipe request to busboy
    req.pipe(bb);
  } catch (err) {
    // Clean up temp files if directory was created
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    res.status(500).json({
      error: 'Setup failed',
      message: (err as Error).message
    });
  }
});

export { router as parseSonglistRoutes };
