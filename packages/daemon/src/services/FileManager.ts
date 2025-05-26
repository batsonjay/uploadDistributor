/**
 * File Manager Service
 * 
 * This service handles the organization of files in the Upload Distributor project.
 * It manages:
 * - Moving files from temporary UUID directories to organized archive structure
 * - Creating appropriate directory structure based on date and DJ name
 * - Generating descriptive filenames that include date, DJ name, and episode title
 * - Cleaning up temporary directories after successful moves
 */

import * as fs from 'fs';
import * as path from 'path';
import { SonglistData } from '../storage/SonglistStorage.js';
import { log, logError } from '@uploadDistributor/logging';

export class FileManager {
  private receivedFilesDir: string;
  private archiveDir: string;
  
  constructor() {
    this.receivedFilesDir = process.env.RECEIVED_FILES_DIR || path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '../../received-files'
    );
    this.archiveDir = process.env.ARCHIVE_DIR || path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '../../archive'
    );
    
    log('D:FILE  ', 'FM:001', `Files directory: ${this.receivedFilesDir}`);
    log('D:FILEDB', 'FM:002', `Archive directory: ${this.archiveDir}`);
    
    // Ensure archive directory exists
    if (!fs.existsSync(this.archiveDir)) {
      log('D:FILE  ', 'FM:003', `Creating archive directory: ${this.archiveDir}`);
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }
  }
  
  /**
   * Move files from temporary UUID directory to organized archive structure
   * @param fileId The UUID of the temporary directory
   * @param songlist The processed songlist data
   * @returns The path to the new directory and a map of original to new filenames
   */
  public moveToArchive(fileId: string, songlist: SonglistData): { archivePath: string, fileMap: Record<string, string> } {
    const tempDir = path.join(this.receivedFilesDir, fileId);
    log('D:FILE  ', 'FM:004', `Moving files from ${tempDir} to archive`);
    
    // Get current date for fallbacks
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0] || '';
    const currentTime = now.toISOString().split('T')[1]?.substring(0, 8) || '';
    
    // Create default broadcast data if needed
    if (!songlist.broadcast_data) {
      songlist.broadcast_data = {
        broadcast_date: currentDate,
        broadcast_time: currentTime || '00:00:00',
        DJ: 'Unknown_DJ',
        setTitle: 'Untitled_Set'
      };
    }
    
    // Extract date components from broadcast_date with fallbacks
    const broadcastDate = songlist.broadcast_data.broadcast_date || currentDate;
    const dateParts = broadcastDate ? broadcastDate.split('-') : (currentDate ? currentDate.split('-') : []);
    const year = dateParts[0] || now.getFullYear().toString();
    const month = dateParts[1] || String(now.getMonth() + 1).padStart(2, '0');
    const day = dateParts[2] || String(now.getDate()).padStart(2, '0');
    
    // Create directory structure: yyyy/
    const yearDir = path.join(this.archiveDir, year as string);
    if (!fs.existsSync(yearDir)) {
      log('D:FILEDB', 'FM:005', `Creating year directory: ${yearDir}`);
      fs.mkdirSync(yearDir, { recursive: true });
    }
    
    // Sanitize DJ name for filesystem use
    const djName = songlist.broadcast_data?.DJ || 'Unknown_DJ';
    const sanitizedDjName = djName.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Use year directory as the final directory
    const finalDir = yearDir;
    
    // Create the base filename prefix
    const title = songlist.broadcast_data?.setTitle || 'Untitled_Set';
    const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '-');
    const filenamePrefix = `${year}-${month}-${day}_${sanitizedDjName}_${sanitizedTitle}`;
    
    // Map to track original filenames to new filenames
    const fileMap: Record<string, string> = {};
    
    // Move all files from temp directory to final directory with descriptive names
    const files = fs.readdirSync(tempDir);
    log('D:FILEDB', 'FM:006', `Found ${files.length} files to move`);
    for (const file of files) {
      const sourcePath = path.join(tempDir, file);
      
      // Determine the new filename based on the original extension
      let destFilename;
      if (file === 'audio.mp3') {
        destFilename = `${filenamePrefix}.mp3`;
      } else if (file === 'songlist.txt') {
        destFilename = `${filenamePrefix}.txt`;
      } else if (file === 'metadata.json') {
        destFilename = `${filenamePrefix}.json`;
      } else if (file === 'status.json') {
        destFilename = `${filenamePrefix}_status.json`;
      } else if (file.startsWith('artwork')) {
        // Preserve the artwork extension
        const ext = path.extname(file);
        destFilename = `${filenamePrefix}${ext}`;
      } else {
        // For any other files, just use the original name
        destFilename = file;
      }
      
      const destPath = path.join(finalDir, destFilename);
      
      // For status.json, ensure it contains the fileId
      if (file === 'status.json') {
        try {
          const statusContent = fs.readFileSync(sourcePath, 'utf8');
          const statusData = JSON.parse(statusContent);
          
          // Add fileId to status data if it doesn't exist
          if (!statusData.fileId) {
            log('D:FILEDB', 'FM:007', `Adding fileId ${fileId} to status.json`);
            statusData.fileId = fileId;
          }
          
          // Write the updated status file
          fs.writeFileSync(destPath, JSON.stringify(statusData, null, 2));
        } catch (err) {
          logError('ERROR   ', 'FM:008', `Error updating status file with fileId:`, err);
          // Fall back to copying the original file
          fs.copyFileSync(sourcePath, destPath);
        }
      } else {
        // Copy the file normally
        log('D:FILEDB', 'FM:009', `Copying ${file} to ${destFilename}`);
        fs.copyFileSync(sourcePath, destPath);
      }
      
      // Add to file map
      fileMap[file] = destFilename;
    }
    
    // Delete the temporary directory after successful move
    log('D:FILE  ', 'FM:010', `Files moved to archive: ${finalDir}`);
    log('D:FILEDB', 'FM:011', `File mapping: ${JSON.stringify(fileMap, null, 2)}`);
    this.deleteDirectory(tempDir);
    
    return {
      archivePath: finalDir,
      fileMap: fileMap
    };
  }
  
  /**
   * Delete a directory and all its contents
   * @param dirPath The directory to delete
   */
  private deleteDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      log('D:FILE  ', 'FM:012', `Deleting directory: ${dirPath}`);
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const curPath = path.join(dirPath, file);
        
        if (fs.lstatSync(curPath).isDirectory()) {
          // Recursive call for directories
          this.deleteDirectory(curPath);
        } else {
          // Delete file
          fs.unlinkSync(curPath);
        }
      }
      
      // Delete the empty directory
      log('D:FILEDB', 'FM:013', `Removing empty directory: ${dirPath}`);
      fs.rmdirSync(dirPath);
    }
  }
  
  /**
   * Get the path to the archive directory
   * @returns The path to the archive directory
   */
  public getArchiveDir(): string {
    return this.archiveDir;
  }
  
  /**
   * Get the path to the received files directory
   * @returns The path to the received files directory
   */
  public getReceivedFilesDir(): string {
    return this.receivedFilesDir;
  }
}
