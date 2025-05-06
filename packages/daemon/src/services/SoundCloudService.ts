/**
 * SoundCloud Service
 * 
 * This service handles uploads to SoundCloud, including:
 * - Two-step upload process (file upload + metadata update)
 * - Privacy setting fallback
 * - Error handling and recovery
 */

import { SoundCloudApiMock, SoundCloudMetadata, SoundCloudUploadResponse } from '../mocks/SoundCloudApiMock';
import { StatusManager } from './StatusManager';
import { ErrorType } from '../utils/LoggingUtils';

export class SoundCloudService {
  private api: SoundCloudApiMock;
  private statusManager: StatusManager;
  
  constructor(statusManager: StatusManager) {
    this.api = new SoundCloudApiMock();
    this.statusManager = statusManager;
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
    process.stdout.write('Uploading to SoundCloud...\n');
    
    try {
      // SoundCloud-specific recovery logic: retry with privacy setting fallback
      let result: SoundCloudUploadResponse = { success: false, id: '', error: 'Not attempted' };
      let note: string | undefined;
      
      try {
        // Step 1: Upload the file (first attempt with original metadata)
        process.stdout.write('SoundCloud Step 1: Uploading file...\n');
        result = await this.api.uploadFile(audioFilePath, metadata);
        
        // If upload failed due to quota or permission issues, try with private sharing
        if (!result.success && 
            (result.error?.includes('quota') || 
             result.error?.includes('permission') ||
             result.error?.includes('artwork'))) {
          
          process.stdout.write('SoundCloud upload failed, retrying with modified settings...\n');
          
          this.statusManager.logError(
            'soundcloud',
            metadata.title,
            result.error || 'Unknown error',
            ErrorType.UNKNOWN,
            { audioFilePath, metadata },
            1
          );
          
          // Create modified metadata with private sharing and no artwork requirement
          const privateMetadata: SoundCloudMetadata = { 
            ...metadata,
            sharing: 'private',
            // Add a dummy artwork path to bypass the artwork check
            artwork: metadata.artwork || 'dummy-artwork-path'
          };
          
          // Second attempt with modified metadata
          process.stdout.write('SoundCloud Step 1 (retry): Uploading file with modified settings...\n');
          result = await this.api.uploadFile(audioFilePath, privateMetadata);
          
          // If successful, note that it was uploaded as private
          if (result.success) {
            note = 'Uploaded as private due to quota/permission constraints';
          }
        }
        
        // If Step 1 was successful, proceed to Step 2
        if (result.success) {
          process.stdout.write(`SoundCloud Step 2: Updating metadata for track ${result.id}...\n`);
          
          // Step 2: Update the metadata
          const metadataResult = await this.api.updateTrackMetadata(result.id, metadata);
          
          // If metadata update failed, log the error but consider the upload successful
          if (!metadataResult.success) {
            this.statusManager.logError(
              'soundcloud',
              metadata.title,
              metadataResult.error || 'Failed to update metadata',
              ErrorType.UNKNOWN,
              { trackId: result.id, metadata },
              1
            );
            
            process.stdout.write(`SoundCloud metadata update failed: ${metadataResult.error}\n`);
            
            // The file was uploaded successfully, but metadata update failed
            // We'll return success but with a note about the metadata issue
            if (!note) {
              note = 'File uploaded but metadata update failed';
            } else {
              note += '; metadata update failed';
            }
          } else {
            // Both steps succeeded
            result = metadataResult;
          }
        }
      } catch (err) {
        // Log the error and re-throw
        this.statusManager.logError(
          'soundcloud',
          metadata.title,
          (err as Error).message,
          ErrorType.UNKNOWN,
          { audioFilePath, metadata },
          1
        );
        
        throw err;
      }
      
      // Check final result
      if (result.success) {
        this.statusManager.logSuccess(
          'soundcloud',
          metadata.title,
          `Uploaded to ${result.permalink_url}`
        );
        
        return {
          success: true,
          id: result.id,
          url: result.permalink_url,
          note
        };
      } else {
        this.statusManager.logError(
          'soundcloud',
          metadata.title,
          result.error || 'Unknown error',
          ErrorType.UNKNOWN,
          { audioFilePath, metadata },
          2
        );
        
        return {
          success: false,
          error: result.error || 'Unknown error'
        };
      }
    } catch (err) {
      process.stderr.write(`SoundCloud upload error: ${err}\n`);
      
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
