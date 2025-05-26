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
import { AzuraCastApiMock, AzuraCastMetadata, AzuraCastUploadResponse } from '../mocks/AzuraCastApiMock.simple.js';
import { StatusManager } from './StatusManager.js';
import { retry, RetryOptions } from '../utils/RetryUtils.js';
import { SonglistData } from '../storage/SonglistStorage.js';
import { utcToCet } from '../utils/TimezoneUtils.js';
import { log, logError } from '@uploadDistributor/logging';

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
    log('D:API   ', 'AZ:001', `Creating metadata from songlist for ${songlist.broadcast_data.DJ || 'Unknown DJ'}`);
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
    log('D:API   ', 'AZ:001', 'Uploading to AzuraCast...');
    log('D:APIDB ', 'AZ:002', `File: ${path.basename(audioFilePath)}`);
    log('D:API   ', 'AZ:003', 'Starting upload to AzuraCast...');
    
    // Define retry options
    const retryOptions: RetryOptions = {
      maxRetries: 2,
      initialDelay: 1000,
      backoffFactor: 2,
      onRetry: (attempt, error, delay) => {
        log('D:APIDB ', 'AZ:004', `AzuraCast operation failed, retrying in ${delay/1000}s... (${attempt}/${retryOptions.maxRetries})`);
        logError('ERROR   ', 'AZ:005', `AzuraCast operation failed: ${error.message}`);
      }
    };
    
    try {
      // Use the retry utility to handle the entire upload process
      const result = await retry(async () => {
        // Step 1: Upload the file
        log('D:APIDB ', 'AZ:006', `Request to uploadFile: ${JSON.stringify({
          file: "[Binary file: " + audioFilePath + "]",
          metadata
        }, null, 2)}`);
        const uploadResult = await this.api.uploadFile(audioFilePath, metadata);
        
        if (!uploadResult.success) {
          logError('ERROR   ', 'AZ:007', `Failed to upload file to AzuraCast: ${uploadResult.error || 'Unknown error'}`);
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            uploadResult.error || 'Unknown error',
            'UNKNOWN',
            { audioFilePath, metadata }
          );
          throw new Error(uploadResult.error || 'Upload failed');
        }
        
        // Step 2: Set metadata
        log('D:APIDB ', 'AZ:008', `Request to setMetadata: ${JSON.stringify({
          fileId: uploadResult.id,
          metadata
        }, null, 2)}`);
        const metadataResult = await this.api.setMetadata(uploadResult.id, metadata);
        
        if (!metadataResult.success) {
          logError('ERROR   ', 'AZ:009', `Failed to set metadata in AzuraCast: ${metadataResult.error || 'Unknown error'}`);
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            metadataResult.error || 'Failed to set metadata',
            'UNKNOWN',
            { trackId: uploadResult.id, metadata }
          );
          throw new Error(metadataResult.error || 'Failed to set metadata');
        }
        
        // Step 3: Add to playlist
        log('D:APIDB ', 'AZ:010', `Request to addToPlaylist: ${JSON.stringify({
          fileId: uploadResult.id,
          playlistId: "1"
        }, null, 2)}`);
        const playlistResult = await this.api.addToPlaylist(uploadResult.id);
        
        if (!playlistResult.success) {
          logError('ERROR   ', 'AZ:011', `Failed to add to playlist in AzuraCast: ${playlistResult.error || 'Unknown error'}`);
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            playlistResult.error || 'Failed to add to playlist',
            'UNKNOWN',
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
      
      // Reduce logging - just log the essential information
      log('D:API   ', 'AZ:012', 'AzuraCast upload completed successfully');
      log('D:APIDB ', 'AZ:013', `File ID: ${result.id}, Path: ${result.path}`);
      
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
        'UNKNOWN',
        { audioFilePath, metadata }
      );
      logError('ERROR   ', 'AZ:014', `AzuraCast upload failed after all retries: ${(err as Error).message}`);
      
      return {
        success: false,
        error: (err as Error).message
      };
    }
  }
}
