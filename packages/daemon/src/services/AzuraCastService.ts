/**
 * AzuraCast Service
 * 
 * This service handles uploads to AzuraCast, including:
 * - File uploads
 * - Metadata updates
 * - Playlist management
 * - Error handling and retries
 */

import path from 'path';
import { AzuraCastApiMock, AzuraCastMetadata, AzuraCastUploadResponse } from '../mocks/AzuraCastApiMock.js';
import { StatusManager } from './StatusManager.js';
import { ErrorType, ParserLogType, logParserEvent } from '../utils/LoggingUtils.js';
import { retry, RetryOptions } from '../utils/RetryUtils.js';
import { SonglistData } from '../storage/SonglistStorage.js';
import { utcToCet } from '../utils/TimezoneUtils.js';

export class AzuraCastService {
  private api: AzuraCastApiMock;
  private statusManager: StatusManager;
  
  constructor(statusManager: StatusManager) {
    this.api = new AzuraCastApiMock();
    this.statusManager = statusManager;
  }
  
  /**
   * Create AzuraCast metadata from a songlist
   * 
   * @param songlist The songlist data
   * @returns AzuraCast metadata object
   */
  public createMetadataFromSonglist(songlist: SonglistData): AzuraCastMetadata {
    // Convert UTC timestamps to CET
    const broadcastDate = songlist.broadcast_data.broadcast_date;
    const broadcastTime = songlist.broadcast_data.broadcast_time;
    const utcTimestamp = `${broadcastDate}T${broadcastTime}Z`;
    const cetTimestamp = utcToCet(utcTimestamp);
    const [cetDate] = cetTimestamp.split(' ');
    
    return {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      album: `${cetDate || new Date().toISOString().split('T')[0]} Broadcast`,
      genre: Array.isArray(songlist.broadcast_data.genre) ? 
             songlist.broadcast_data.genre.join(', ') || 'Radio Show' : 
             songlist.broadcast_data.genre || 'Radio Show'
    };
  }
  
  /**
   * Upload a file to AzuraCast with retry logic
   */
  public async uploadFile(
    audioFilePath: string, 
    metadata: AzuraCastMetadata
  ): Promise<{ success: boolean; id?: string; path?: string; error?: string }> {
    logParserEvent('AzuraCastService', ParserLogType.DEBUG, 'Uploading to AzuraCast...');
    logParserEvent('AzuraCastService', ParserLogType.DEBUG, `File being uploaded to AzuraCast: ${audioFilePath}`);
    logParserEvent('AzuraCastService', ParserLogType.DEBUG, `Original filename: ${path.basename(audioFilePath)}`);
    logParserEvent('AzuraCastService', ParserLogType.DEBUG, 'Metadata:', metadata);
    
    // Define retry options
    const retryOptions: RetryOptions = {
      maxRetries: 2,
      initialDelay: 1000,
      backoffFactor: 2,
      onRetry: (attempt, error, delay) => {
        logParserEvent('AzuraCastService', ParserLogType.DEBUG, 
          `AzuraCast operation failed, retrying in ${delay/1000}s... (${attempt}/${retryOptions.maxRetries})`);
      }
    };
    
    try {
      // Use the retry utility to handle the entire upload process
      const result = await retry(async () => {
        // Step 1: Upload the file
        const uploadResult = await this.api.uploadFile(audioFilePath, metadata);
        
        if (!uploadResult.success) {
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            uploadResult.error || 'Unknown error',
            ErrorType.UNKNOWN,
            { audioFilePath, metadata }
          );
          throw new Error(uploadResult.error || 'Upload failed');
        }
        
        // Step 2: Set metadata
        const metadataResult = await this.api.setMetadata(uploadResult.id, metadata);
        
        if (!metadataResult.success) {
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            metadataResult.error || 'Failed to set metadata',
            ErrorType.UNKNOWN,
            { trackId: uploadResult.id, metadata }
          );
          throw new Error(metadataResult.error || 'Failed to set metadata');
        }
        
        // Step 3: Add to playlist
        const playlistResult = await this.api.addToPlaylist(uploadResult.id);
        
        if (!playlistResult.success) {
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            playlistResult.error || 'Failed to add to playlist',
            ErrorType.UNKNOWN,
            { trackId: uploadResult.id }
          );
          throw new Error(playlistResult.error || 'Failed to add to playlist');
        }
        
        // All steps succeeded, return the result
        return uploadResult;
      }, retryOptions);
      
      // Log success
      this.statusManager.logSuccess(
        'azuracast',
        metadata.title,
        `Uploaded to ${result.path}`
      );
      
      // Log the final result with path information
      logParserEvent('AzuraCastService', ParserLogType.DEBUG, 'AzuraCast upload completed successfully:');
      logParserEvent('AzuraCastService', ParserLogType.DEBUG, `  - Original file: ${path.basename(audioFilePath)}`);
      logParserEvent('AzuraCastService', ParserLogType.DEBUG, `  - File ID: ${result.id}`);
      logParserEvent('AzuraCastService', ParserLogType.DEBUG, `  - Destination path: ${result.path}`);
      logParserEvent('AzuraCastService', ParserLogType.DEBUG, `  - Destination filename: ${path.basename(result.path || '')}`);
      logParserEvent('AzuraCastService', ParserLogType.DEBUG, `  - Title: ${metadata.title}`);
      logParserEvent('AzuraCastService', ParserLogType.DEBUG, `  - Artist: ${metadata.artist}`);
      logParserEvent('AzuraCastService', ParserLogType.DEBUG, `  - Genre: ${metadata.genre || 'Not specified'}`);
      
      return {
        success: true,
        id: result.id,
        path: result.path
      };
    } catch (err) {
      // Final error after all retries
      this.statusManager.logError(
        'azuracast',
        metadata.title,
        (err as Error).message,
        ErrorType.UNKNOWN,
        { audioFilePath, metadata }
      );
      
      return {
        success: false,
        error: (err as Error).message
      };
    }
  }
}
