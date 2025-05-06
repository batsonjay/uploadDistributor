/**
 * AzuraCast Service
 * 
 * This service handles uploads to AzuraCast, including:
 * - File uploads
 * - Metadata updates
 * - Playlist management
 * - Error handling and retries
 */

import { AzuraCastApiMock, AzuraCastMetadata, AzuraCastUploadResponse } from '../mocks/AzuraCastApiMock';
import { StatusManager } from './StatusManager';
import { ErrorType } from '../utils/LoggingUtils';

export class AzuraCastService {
  private api: AzuraCastApiMock;
  private statusManager: StatusManager;
  
  constructor(statusManager: StatusManager) {
    this.api = new AzuraCastApiMock();
    this.statusManager = statusManager;
  }
  
  /**
   * Upload a file to AzuraCast with retry logic
   */
  public async uploadFile(
    audioFilePath: string, 
    metadata: AzuraCastMetadata
  ): Promise<{ success: boolean; id?: string; path?: string; error?: string }> {
    process.stdout.write('Uploading to AzuraCast...\n');
    
    // AzuraCast-specific recovery logic: retry up to 2 times with exponential backoff
    let result: AzuraCastUploadResponse = { success: false, id: '', error: 'Not attempted' };
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        // Step 1: Upload the file
        result = await this.api.uploadFile(audioFilePath, metadata);
        
        if (!result.success) {
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            result.error || 'Unknown error',
            ErrorType.UNKNOWN,
            { audioFilePath, metadata },
            retryCount + 1
          );
          
          if (retryCount < maxRetries) {
            const backoffTime = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s, etc.
            process.stdout.write(`AzuraCast upload failed, retrying in ${backoffTime/1000}s... (${retryCount + 1}/${maxRetries})\n`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            retryCount++;
            continue;
          } else {
            return {
              success: false,
              error: result.error || 'Unknown error'
            };
          }
        }
        
        // Step 2: Set metadata
        const metadataResult = await this.api.setMetadata(result.id, metadata);
        
        if (!metadataResult.success) {
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            metadataResult.error || 'Failed to set metadata',
            ErrorType.UNKNOWN,
            { trackId: result.id, metadata },
            retryCount + 1
          );
          
          if (retryCount < maxRetries) {
            const backoffTime = Math.pow(2, retryCount) * 1000;
            process.stdout.write(`AzuraCast metadata update failed, retrying in ${backoffTime/1000}s... (${retryCount + 1}/${maxRetries})\n`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            retryCount++;
            continue;
          } else {
            return {
              success: false,
              error: metadataResult.error || 'Failed to set metadata'
            };
          }
        }
        
        // Step 3: Add to playlist
        const playlistResult = await this.api.addToPlaylist(result.id);
        
        if (!playlistResult.success) {
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            playlistResult.error || 'Failed to add to playlist',
            ErrorType.UNKNOWN,
            { trackId: result.id },
            retryCount + 1
          );
          
          if (retryCount < maxRetries) {
            const backoffTime = Math.pow(2, retryCount) * 1000;
            process.stdout.write(`AzuraCast playlist update failed, retrying in ${backoffTime/1000}s... (${retryCount + 1}/${maxRetries})\n`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            retryCount++;
            continue;
          } else {
            return {
              success: false,
              error: playlistResult.error || 'Failed to add to playlist'
            };
          }
        }
        
        // All steps succeeded, break out of retry loop
        break;
      } catch (err) {
        this.statusManager.logError(
          'azuracast',
          metadata.title,
          (err as Error).message,
          ErrorType.UNKNOWN,
          { audioFilePath, metadata },
          retryCount + 1
        );
        
        if (retryCount < maxRetries) {
          const backoffTime = Math.pow(2, retryCount) * 1000;
          process.stdout.write(`AzuraCast upload error, retrying in ${backoffTime/1000}s... (${retryCount + 1}/${maxRetries})\n`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          retryCount++;
        } else {
          return {
            success: false,
            error: (err as Error).message
          };
        }
      }
    }
    
    // If we got here, the upload was successful
    if (result.success) {
      this.statusManager.logSuccess(
        'azuracast',
        metadata.title,
        `Uploaded to ${result.path}`
      );
      
      return {
        success: true,
        id: result.id,
        path: result.path
      };
    }
    
    // This should never happen, but just in case
    return {
      success: false,
      error: 'Unknown error occurred'
    };
  }
}
