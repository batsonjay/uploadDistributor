/**
 * Simplified Mixcloud API Mock
 * 
 * This is a simplified version of the MixcloudApiMock that doesn't import AuthService.
 */

import { DestinationApiMock } from './DestinationApiMock.js';
import * as fs from 'fs';

export interface MixcloudUploadResponse {
  success: boolean;
  id: string;
  url?: string;
  error?: string;
}

export interface MixcloudMetadata {
  title: string;
  artist: string;
  description?: string;
  tags?: string[];
  publishDate?: string;
  track_list?: Array<{ title: string; artist: string }>;
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
        id: '',
        error: 'Missing required metadata fields'
      };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        id: '',
        error: `File not found: ${filePath}`
      };
    }

    // Record the request
    this.recordRequest('uploadFile', {
      file: `[Binary file: ${filePath}]`,
      metadata
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return success response
    const trackId = `mock-mixcloud-${Date.now()}`;
    return {
      success: true,
      id: trackId,
      url: `https://www.mixcloud.com/${metadata.artist.toLowerCase().replace(/\s+/g, '-')}/${metadata.title.toLowerCase().replace(/\s+/g, '-')}/`
    };
  }

  /**
   * Set metadata for a track
   */
  public async setMetadata(
    trackId: string,
    metadata: MixcloudMetadata
  ): Promise<{ success: boolean; error?: string }> {
    // Validate required fields
    const isValid = this.validateRequiredFields(metadata, ['title', 'artist']);
    if (!isValid) {
      return {
        success: false,
        error: 'Missing required metadata fields'
      };
    }

    // Record the request
    this.recordRequest('setMetadata', {
      trackId,
      metadata
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return success response
    return {
      success: true
    };
  }

  /**
   * Schedule a track for publishing
   */
  public async schedulePublish(
    trackId: string,
    publishDate: string
  ): Promise<{ success: boolean; error?: string }> {
    // Validate publish date
    if (!publishDate) {
      return {
        success: false,
        error: 'Missing publish date'
      };
    }

    // Record the request
    this.recordRequest('schedulePublish', {
      trackId,
      publishDate
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 300));

    // Return success response
    return {
      success: true
    };
  }

  /**
   * Get the status of an upload
   */
  public async getUploadStatus(
    uploadId: string
  ): Promise<{ success: boolean; status: string; error?: string }> {
    // Record the request
    this.recordRequest('getUploadStatus', {
      uploadId
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200));

    // Return success response
    return {
      success: true,
      status: 'completed'
    };
  }
}
