/**
 * Mixcloud Service
 * 
 * This service handles uploads to Mixcloud, including:
 * - File uploads with metadata
 * - Track list validation
 * - Error handling and recovery
 */

import { MixcloudApiMock, MixcloudMetadata, MixcloudUploadResponse } from '../mocks/MixcloudApiMock.simple.js';
import { StatusManager } from './StatusManager.js';
import { retry, RetryOptions } from '../utils/RetryUtils.js';
import { SonglistData } from '../storage/SonglistStorage.js';
import { utcToCet } from '../utils/TimezoneUtils.js';
import { log, logError } from '@uploadDistributor/logging';

export class MixcloudService {
  private api: MixcloudApiMock;
  private statusManager: StatusManager;
  
  constructor(statusManager: StatusManager) {
    this.api = new MixcloudApiMock();
    this.statusManager = statusManager;
  }
  
  /**
   * Create Mixcloud metadata from a songlist
   * 
   * @param songlist The songlist data
   * @returns Mixcloud metadata object
   */
  public createMetadataFromSonglist(songlist: SonglistData): MixcloudMetadata {
    // Convert UTC timestamps to CET
    const broadcastDate = songlist.broadcast_data.broadcast_date;
    const broadcastTime = songlist.broadcast_data.broadcast_time;
    const utcTimestamp = `${broadcastDate}T${broadcastTime}Z`;
    const cetTimestamp = utcToCet(utcTimestamp);
    const [cetDate, cetTime] = cetTimestamp.split(' ');
    
    // Get tags from songlist if available
    const tags = songlist.platform_specific?.mixcloud?.tags || 
                 songlist.broadcast_data.genre || 
                 [];
    
    return {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      description: `Broadcast on ${cetDate || new Date().toISOString().split('T')[0]} at ${cetTime || '00:00:00'}`,
      track_list: songlist.track_list || [],
      tags: tags
    };
  }
  
  /**
   * Upload a file to Mixcloud with recovery logic
   */
  public async uploadFile(
    audioFilePath: string, 
    metadata: MixcloudMetadata
  ): Promise<{ success: boolean; id?: string; url?: string; error?: string }> {
    log('D:API   ', 'MX:001', 'Uploading to Mixcloud...');
    
    // Track whether we've already tried with simplified metadata
    let usedSimplifiedMetadata = false;
    let currentMetadata = { ...metadata };
    
    // Define retry options with custom isRetryable function
    const retryOptions: RetryOptions = {
      maxRetries: 1, // Only retry once for Mixcloud
      initialDelay: 1000,
      onRetry: (attempt, error, delay) => {
        log('D:API   ', 'MX:002', `Mixcloud upload failed, retrying in ${delay/1000}s... (${attempt}/1)`);
      },
      // Custom function to determine if an error is retryable and to modify the metadata
      isRetryable: (error: Error) => {
        // If we've already tried with simplified metadata, don't retry again
        if (usedSimplifiedMetadata) {
          return false;
        }
        
        // If the error is related to track list validation, simplify the track list
        if (error.message.includes('track list')) {
          log('D:API   ', 'MX:003', 'Mixcloud upload failed due to track list issues, retrying with simplified track list...');
          
          // Create simplified track list (limit to 5 tracks if there are more)
          if (currentMetadata.track_list && currentMetadata.track_list.length > 5) {
            currentMetadata.track_list = currentMetadata.track_list.slice(0, 5);
            log('D:API   ', 'MX:004', `Simplified track list to ${currentMetadata.track_list.length} tracks`);
          }
          
          usedSimplifiedMetadata = true;
          return true;
        }
        
        // For other errors, don't retry
        return false;
      }
    };
    
    try {
      // Use the retry utility for the upload process
      const result = await retry(async () => {
        // Attempt to upload with current metadata
        const uploadResult = await this.api.uploadFile(audioFilePath, currentMetadata);
        
        if (!uploadResult.success) {
          this.statusManager.logError(
            'mixcloud',
            metadata.title,
            uploadResult.error || 'Unknown error',
            uploadResult.error?.includes('track list') ? 'VALIDATION' : 'UNKNOWN',
            { audioFilePath, metadata: currentMetadata }
          );
          
          throw new Error(uploadResult.error || 'Upload failed');
        }
        
        return uploadResult;
      }, retryOptions);
      
      // Log success
      this.statusManager.logSuccess(
        'mixcloud',
        metadata.title,
        `Uploaded to ${result.url}`
      );
      
      return {
        success: true,
        id: result.id,
        url: result.url
      };
    } catch (err) {
      // Final error after all retries
      logError('ERROR   ', 'MX:005', `Mixcloud upload error: ${err}`);
      
      this.statusManager.logError(
        'mixcloud',
        metadata.title,
        (err as Error).message,
        'UNKNOWN',
        { audioFilePath, metadata: currentMetadata }
      );
      
      return {
        success: false,
        error: (err as Error).message
      };
    }
  }
  
  /**
   * Check the status of an upload
   */
  public async checkUploadStatus(
    uploadId: string
  ): Promise<{ success: boolean; status: string; error?: string }> {
    try {
      return await this.api.getUploadStatus(uploadId);
    } catch (err) {
      return {
        success: false,
        status: 'error',
        error: (err as Error).message
      };
    }
  }
}
