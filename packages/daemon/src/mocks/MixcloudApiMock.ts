/**
 * Mixcloud API Mock
 * 
 * This mock simulates the Mixcloud API for testing purposes.
 */

import { DestinationApiMock } from './DestinationApiMock.js';
import * as fs from 'fs';
import { log } from '@uploadDistributor/logging';

export interface MixcloudUploadResponse {
  success: boolean;
  id?: string;
  url?: string;
  error?: string;
}

export interface MixcloudTrack {
  title: string;
  artist: string;
}

export interface MixcloudMetadata {
  title: string;
  artist: string;
  description?: string;
  tags?: string[];
  track_list?: MixcloudTrack[];
}

export class MixcloudApiMock extends DestinationApiMock {
  constructor() {
    super('mixcloud');
  }

  /**
   * Upload a file to Mixcloud
   */
  public async uploadFile(
    filePath: string,
    metadata: MixcloudMetadata
  ): Promise<MixcloudUploadResponse> {
    // Validate required fields
    const isValid = this.validateRequiredFields(metadata, ['title', 'artist']);
    if (!isValid) {
      return {
        success: false,
        error: 'Missing required metadata fields'
      };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      };
    }

    // Record the request
    this.recordRequest('uploadFile', {
      file: `[Binary file: ${filePath}]`,
      metadata
    });

    // Validate track list if provided
    if (metadata.track_list && metadata.track_list.length > 0) {
      // Check if all tracks have required fields
      const trackValid = metadata.track_list.every(track => 
        track.title && track.artist
      );
      
      if (!trackValid) {
        return {
          success: false,
          error: 'Track list contains items missing required fields'
        };
      }
      
      log('D:APIDB ', 'MM:001', `Track list validated with ${metadata.track_list.length} tracks`);
    }

    // Simulate processing time (longer for Mixcloud)
    await new Promise(resolve => setTimeout(resolve, 800));

    // Return success response
    const uploadId = `mock-mixcloud-${Date.now()}`;
    return {
      success: true,
      id: uploadId,
      url: `https://www.mixcloud.com/${metadata.artist.replace(/\s+/g, '-').toLowerCase()}/${metadata.title.replace(/\s+/g, '-').toLowerCase()}/`
    };
  }

  /**
   * Get upload status
   */
  public async getUploadStatus(
    uploadId: string
  ): Promise<{ success: boolean; status: string; error?: string }> {
    // Record the request
    this.recordRequest('getUploadStatus', { uploadId });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200));

    // Return success response
    return {
      success: true,
      status: 'completed'
    };
  }
}
