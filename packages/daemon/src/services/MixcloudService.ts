/**
 * Mixcloud Service
 * 
 * This service handles uploads to Mixcloud, including:
 * - File uploads with metadata
 * - Track list validation
 * - Error handling and recovery
 */

import { MixcloudApiMock, MixcloudMetadata, MixcloudUploadResponse } from '../mocks/MixcloudApiMock';
import { StatusManager } from './StatusManager';
import { ErrorType } from '../utils/LoggingUtils';

export class MixcloudService {
  private api: MixcloudApiMock;
  private statusManager: StatusManager;
  
  constructor(statusManager: StatusManager) {
    this.api = new MixcloudApiMock();
    this.statusManager = statusManager;
  }
  
  /**
   * Upload a file to Mixcloud with recovery logic
   */
  public async uploadFile(
    audioFilePath: string, 
    metadata: MixcloudMetadata
  ): Promise<{ success: boolean; id?: string; url?: string; error?: string }> {
    process.stdout.write('Uploading to Mixcloud...\n');
    
    try {
      // Mixcloud-specific recovery logic: single retry with validation check
      let result: MixcloudUploadResponse = { success: false, error: 'Not attempted' };
      
      try {
        // First attempt with full metadata
        result = await this.api.uploadFile(audioFilePath, metadata);
        
        // If upload failed due to track list validation, try again with a simplified track list
        if (!result.success && result.error?.includes('track list')) {
          process.stdout.write('Mixcloud upload failed due to track list issues, retrying with simplified track list...\n');
          
          this.statusManager.logError(
            'mixcloud',
            metadata.title,
            result.error,
            ErrorType.VALIDATION,
            { audioFilePath, metadata },
            1
          );
          
          // Create simplified track list (limit to 5 tracks if there are more)
          const simplifiedMetadata = { ...metadata };
          if (simplifiedMetadata.track_list && simplifiedMetadata.track_list.length > 5) {
            simplifiedMetadata.track_list = simplifiedMetadata.track_list.slice(0, 5);
            process.stdout.write(`Simplified track list to ${simplifiedMetadata.track_list.length} tracks\n`);
          }
          
          // Second attempt with simplified metadata
          result = await this.api.uploadFile(audioFilePath, simplifiedMetadata);
        }
      } catch (err) {
        // Log the error and re-throw
        this.statusManager.logError(
          'mixcloud',
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
          'mixcloud',
          metadata.title,
          `Uploaded to ${result.url}`
        );
        
        return {
          success: true,
          id: result.id,
          url: result.url
        };
      } else {
        this.statusManager.logError(
          'mixcloud',
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
      process.stderr.write(`Mixcloud upload error: ${err}\n`);
      
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
