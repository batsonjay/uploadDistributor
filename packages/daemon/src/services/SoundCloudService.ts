/**
 * SoundCloud Service
 * 
 * This service handles uploads to SoundCloud, including:
 * - Two-step upload process (file upload + metadata update)
 * - Privacy setting fallback
 * - Error handling and recovery
 */

import { SoundCloudApiMock, SoundCloudMetadata, SoundCloudUploadResponse } from '../mocks/SoundCloudApiMock.js';
import { StatusManager } from './StatusManager.js';
import { retry, RetryOptions } from '../utils/RetryUtils.js';
import { SonglistData } from '../storage/SonglistStorage.js';
import { utcToCet } from '../utils/TimezoneUtils.js';
import { log, logError } from '@uploadDistributor/logging';

export class SoundCloudService {
  private api: SoundCloudApiMock;
  private statusManager: StatusManager;
  
  constructor(statusManager: StatusManager) {
    this.api = new SoundCloudApiMock();
    this.statusManager = statusManager;
  }
  
  /**
   * Create SoundCloud metadata from a songlist
   * 
   * @param songlist The songlist data
   * @param artworkFile Path to the artwork file
   * @returns SoundCloud metadata object
   */
  public createMetadataFromSonglist(songlist: SonglistData, artworkFile: string): SoundCloudMetadata {
    // Convert UTC timestamps to CET
    const broadcastDate = songlist.broadcast_data.broadcast_date;
    const broadcastTime = songlist.broadcast_data.broadcast_time;
    const utcTimestamp = `${broadcastDate}T${broadcastTime}Z`;
    const cetTimestamp = utcToCet(utcTimestamp);
    const [cetDate, cetTime] = cetTimestamp.split(' ');
    
    // Get sharing setting from platform-specific data or default to public
    const sharing = songlist.platform_specific?.soundcloud?.sharing || 'public';
    
    // Create tag_list from genre array for SoundCloud
    const tagList = Array.isArray(songlist.broadcast_data.genre) ? 
      songlist.broadcast_data.genre.join(' ') : 
      songlist.broadcast_data.genre || '';
    
    return {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      description: songlist.broadcast_data.description || 
                  `Broadcast on ${cetDate || new Date().toISOString().split('T')[0]} at ${cetTime || '00:00:00'}`,
      genre: Array.isArray(songlist.broadcast_data.genre) ? 
             songlist.broadcast_data.genre[0] || 'Radio Show' : 
             songlist.broadcast_data.genre || 'Radio Show',
      tag_list: tagList,
      sharing: sharing as 'public' | 'private',
      artwork: artworkFile
    };
  }
  
  /**
   * Upload a file to SoundCloud with recovery logic
   * Implements the two-step process:
   * 1. Upload the file
   * 2. Update the metadata
   */
  public async uploadFile(
    audioFilePath: string, 
    metadata: SoundCloudMetadata
  ): Promise<{ success: boolean; id?: string; url?: string; error?: string; note?: string }> {
    log('D:API   ', 'SC:001', 'Uploading to SoundCloud...');
    
    // Track whether we've already tried with private sharing
    let usedPrivateSharing = false;
    let currentMetadata = { ...metadata };
    let note: string | undefined;
    let uploadResult: SoundCloudUploadResponse | null = null;
    
    // Define retry options for the file upload step
    const uploadRetryOptions: RetryOptions = {
      maxRetries: 1, // Only retry once for SoundCloud
      initialDelay: 1000,
      onRetry: (attempt, error, delay) => {
        log('D:API   ', 'SC:002', `SoundCloud upload failed, retrying with modified settings in ${delay/1000}s... (${attempt}/1)`);
      },
      // Custom function to determine if an error is retryable and to modify the metadata
      isRetryable: (error: Error) => {
        // If we've already tried with private sharing, don't retry again
        if (usedPrivateSharing) {
          return false;
        }
        
        // If the error is related to quota, permission, or artwork issues, modify the metadata
        if (error.message.includes('quota') || 
            error.message.includes('permission') || 
            error.message.includes('artwork')) {
          
          log('D:API   ', 'SC:003', 'SoundCloud upload failed due to quota/permission/artwork issues, retrying with private sharing...');
          
          // Create modified metadata with private sharing and dummy artwork
          currentMetadata = { 
            ...currentMetadata,
            sharing: 'private',
            // Add a dummy artwork path to bypass the artwork check
            artwork: currentMetadata.artwork || 'dummy-artwork-path'
          };
          
          usedPrivateSharing = true;
          note = 'Uploaded as private due to quota/permission constraints';
          return true;
        }
        
        // For other errors, don't retry
        return false;
      }
    };
    
    try {
      // Step 1: Upload the file with retry logic
      log('D:API   ', 'SC:004', 'SoundCloud Step 1: Uploading file...');
      
      uploadResult = await retry(async () => {
        // Attempt to upload with current metadata
        const result = await this.api.uploadFile(audioFilePath, currentMetadata);
        
        if (!result.success) {
          this.statusManager.logError(
            'soundcloud',
            metadata.title,
            result.error || 'Unknown error',
            'UNKNOWN',
            { audioFilePath, metadata: currentMetadata }
          );
          
          throw new Error(result.error || 'Upload failed');
        }
        
        return result;
      }, uploadRetryOptions);
      
      // Step 2: Update metadata if Step 1 was successful
      if (uploadResult && uploadResult.success) {
        log('D:API   ', 'SC:005', `SoundCloud Step 2: Updating metadata for track ${uploadResult.id}...`);
        
        try {
          // No retry for metadata update - if it fails, we still consider the upload successful
          const metadataResult = await this.api.updateTrackMetadata(uploadResult.id, metadata);
          
          if (!metadataResult.success) {
            this.statusManager.logError(
              'soundcloud',
              metadata.title,
              metadataResult.error || 'Failed to update metadata',
              'UNKNOWN',
              { trackId: uploadResult.id, metadata }
            );
            
            log('D:API   ', 'SC:006', `SoundCloud metadata update failed: ${metadataResult.error}`);
            
            // The file was uploaded successfully, but metadata update failed
            if (!note) {
              note = 'File uploaded but metadata update failed';
            } else {
              note += '; metadata update failed';
            }
          } else {
            // Both steps succeeded, use the metadata result as the final result
            uploadResult = metadataResult;
          }
        } catch (err) {
          // Log the metadata update error but don't fail the overall upload
          this.statusManager.logError(
            'soundcloud',
            metadata.title,
            (err as Error).message,
            'UNKNOWN',
            { trackId: uploadResult.id, metadata }
          );
          
          if (!note) {
            note = `File uploaded but metadata update failed: ${(err as Error).message}`;
          } else {
            note += `; metadata update failed: ${(err as Error).message}`;
          }
        }
      }
      
      // Check final result
      if (uploadResult && uploadResult.success) {
        this.statusManager.logSuccess(
          'soundcloud',
          metadata.title,
          `Uploaded to ${uploadResult.permalink_url}`
        );
        
        return {
          success: true,
          id: uploadResult.id,
          url: uploadResult.permalink_url,
          note
        };
      } else {
        // This should never happen since we throw errors for failed uploads
        return {
          success: false,
          error: 'Unknown error occurred'
        };
      }
    } catch (err) {
      // Final error after all retries
      logError('ERROR   ', 'SC:007', `SoundCloud upload error: ${err}`);
      
      this.statusManager.logError(
        'soundcloud',
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
   * Get information about a track
   */
  public async getTrackInfo(
    trackId: string
  ): Promise<{ success: boolean; track?: any; error?: string }> {
    try {
      return await this.api.getTrackInfo(trackId);
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message
      };
    }
  }
  
  /**
   * Update track information
   */
  public async updateTrackInfo(
    trackId: string,
    metadata: Partial<SoundCloudMetadata>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await this.api.updateTrackInfo(trackId, metadata);
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message
      };
    }
  }
}
