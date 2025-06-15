/**
 * Cleanup Manager Service
 * 
 * This service handles the cleanup and archival of files in the Upload Distributor project.
 * It manages:
 * - Moving essential files from temporary UUID directories to organized archive structure
 * - Creating appropriate directory structure based on date and DJ name
 * - Generating descriptive filenames that include date, DJ name, and episode title
 * - Creating comprehensive combined files with upload results and tracklist
 * - Selectively archiving files based on upload success/failure
 * - Cleaning up temporary directories after successful moves
 */

import * as fs from 'fs';
import * as path from 'path';
import { SonglistData } from '../storage/SonglistStorage.js';
import { log, logError } from '@uploadDistributor/logging';

export interface PlatformUploadResult {
  success: boolean;
  timestamp: string;
  fileId?: string | number;
  path?: string;
  playlistId?: string | number;
  scheduled?: boolean;
  url?: string; // For Mixcloud/SoundCloud URLs
  error?: string;
  step?: string;
}

export interface UploadResults {
  azuracast?: PlatformUploadResult;
  mixcloud?: PlatformUploadResult;
  soundcloud?: PlatformUploadResult;
}

export class CleanupManager {
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
    
    log('D:FILE  ', 'CM:001', `Files directory: ${this.receivedFilesDir}`);
    log('D:FILE  ', 'CM:002', `Archive directory: ${this.archiveDir}`);
    
    // Ensure archive directory exists
    if (!fs.existsSync(this.archiveDir)) {
      log('D:FILE  ', 'CM:003', `Creating archive directory: ${this.archiveDir}`);
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }
  }
  
  /**
   * Move files from temporary UUID directory to organized archive structure with selective archiving
   * @param fileId The UUID of the temporary directory
   * @param songlist The processed songlist data
   * @param uploadResults The upload results containing success/failure for each platform
   * @param originalMetadata The original metadata from the upload
   * @returns The path to the new directory and a map of original to new filenames
   */
  public moveToArchive(fileId: string, songlist: SonglistData, uploadResults?: UploadResults, originalMetadata?: any): { archivePath: string, fileMap: Record<string, string> } {
    const tempDir = path.join(this.receivedFilesDir, fileId);
    log('D:FILE  ', 'CM:004', `Moving files from ${tempDir} to archive (selective archiving enabled)`);
    
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
      log('D:FILEDB', 'CM:005', `Creating year directory: ${yearDir}`);
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
    
    // Create comprehensive combined file
    if (uploadResults || originalMetadata) {
      this.createCombinedFile(finalDir, filenamePrefix, fileId, songlist, uploadResults, originalMetadata);
    }
    
    // Map to track original filenames to new filenames
    const fileMap: Record<string, string> = {};
    
    // Get list of files to process
    const files = fs.readdirSync(tempDir);
    log('D:FILEDB', 'CM:006', `Found ${files.length} files to process`);
    
    // Always delete these files regardless of success/failure
    const filesToDelete = [
      'audio.mp3', // Large file, not needed for archival
      'status.json' // Replaced by combined file
    ];
    
    // Add artwork file to delete list if it exists
    const artworkFile = files.find(f => f.startsWith('artwork'));
    if (artworkFile) {
      filesToDelete.push(artworkFile); // Artwork not needed for archival
    }
    
    // Process files - only delete unwanted files, don't keep any separate files
    for (const file of files) {
      if (filesToDelete.includes(file)) {
        log('D:FILEDB', 'CM:007', `Deleting file: ${file} (not needed for archival)`);
        // File is deleted when temp directory is removed
        continue;
      }
    }
    
    // Add the combined file to the file map
    const combinedFilename = `${filenamePrefix}.json`;
    fileMap['combined'] = combinedFilename;
    
    // Delete the temporary directory after processing
    log('D:FILE  ', 'CM:008', `Files processed, cleaning up temp directory: ${tempDir}`);
    log('D:FILEDB', 'CM:009', `Created combined file: ${combinedFilename}`);
    this.deleteDirectory(tempDir);
    
    return {
      archivePath: finalDir,
      fileMap: fileMap
    };
  }

  /**
   * Create comprehensive combined file with all upload information
   * @param archiveDir The archive directory path
   * @param filenamePrefix The base filename prefix
   * @param fileId The file ID
   * @param songlist The songlist data
   * @param uploadResults The upload results for all platforms
   * @param originalMetadata The original metadata from upload
   */
  private createCombinedFile(
    archiveDir: string, 
    filenamePrefix: string, 
    fileId: string, 
    songlist: SonglistData, 
    uploadResults?: UploadResults,
    originalMetadata?: any
  ): void {
    const combinedFilename = `${filenamePrefix}.json`;
    const combinedPath = path.join(archiveDir, combinedFilename);
    
    // Count tracks
    const trackCount = songlist.track_list ? songlist.track_list.length : 0;
    
    // Determine overall upload success
    const hasAnySuccess = uploadResults && Object.values(uploadResults).some(result => result?.success);
    
    // Create comprehensive combined object
    const combined = {
      // 1. SUMMARY (most important info at top)
      summary: {
        fileId: fileId,
        dj: songlist.broadcast_data.DJ,
        title: songlist.broadcast_data.setTitle,
        date: songlist.broadcast_data.broadcast_date,
        time: songlist.broadcast_data.broadcast_time,
        genre: Array.isArray(songlist.broadcast_data.genre) ? 
               songlist.broadcast_data.genre.join(', ') : 
               songlist.broadcast_data.genre || '',
        description: songlist.broadcast_data.description || originalMetadata?.description || '',
        trackCount: trackCount,
        uploadedBy: originalMetadata?.uploadedBy || 'Unknown',
        processedAt: new Date().toISOString()
      },
      
      // 2. METADATA (original submission details)
      metadata: {
        userId: originalMetadata?.userId || '',
        userRole: originalMetadata?.userRole || 'DJ',
        requestedDestinations: originalMetadata?.destinations ? 
          originalMetadata.destinations.split(',').map((d: string) => d.trim()) : 
          ['azuracast'],
        hasPreValidatedSongs: originalMetadata?.hasPreValidatedSongs === 'true' || originalMetadata?.hasPreValidatedSongs === true,
        artworkFilename: originalMetadata?.artworkFilename || ''
      },
      
      // 3. UPLOADS (results for each platform)
      uploads: uploadResults || {
        azuracast: {
          success: false,
          timestamp: new Date().toISOString(),
          error: 'No upload results provided',
          step: 'unknown'
        }
      },
      
      // 4. TRACKLIST (detailed song list last)
      tracklist: songlist.track_list || []
    };
    
    try {
      fs.writeFileSync(combinedPath, JSON.stringify(combined, null, 2));
      log('D:FILEDB', 'CM:010', `Created combined file: ${combinedFilename}`);
    } catch (err) {
      logError('ERROR   ', 'CM:011', `Failed to create combined file:`, err);
    }
  }
  
  /**
   * Delete a directory and all its contents
   * @param dirPath The directory to delete
   */
  private deleteDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      log('D:FILE  ', 'CM:012', `Deleting directory: ${dirPath}`);
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
      log('D:FILEDB', 'CM:013', `Removing empty directory: ${dirPath}`);
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
