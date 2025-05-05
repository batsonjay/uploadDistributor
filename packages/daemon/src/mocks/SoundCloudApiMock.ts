/**
 * SoundCloud API Mock
 * 
 * This mock simulates the SoundCloud API for testing purposes.
 */

import { DestinationApiMock } from './DestinationApiMock';
import * as fs from 'fs';

export interface SoundCloudUploadResponse {
  success: boolean;
  id?: string;
  permalink_url?: string;
  error?: string;
}

export interface SoundCloudMetadata {
  title: string;
  artist: string;
  description?: string;
  genre?: string;
  sharing?: 'public' | 'private';
  tags?: string[];
}

export class SoundCloudApiMock extends DestinationApiMock {
  constructor() {
    super('soundcloud');
  }

  /**
   * Upload a file to SoundCloud
   */
  public async uploadFile(
    filePath: string,
    metadata: SoundCloudMetadata
  ): Promise<SoundCloudUploadResponse> {
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

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 700));

    // Return success response
    const trackId = `mock-soundcloud-${Date.now()}`;
    return {
      success: true,
      id: trackId,
      permalink_url: `https://soundcloud.com/${metadata.artist.replace(/\s+/g, '-').toLowerCase()}/${metadata.title.replace(/\s+/g, '-').toLowerCase()}-${trackId.substring(trackId.length - 6)}`
    };
  }

  /**
   * Get track info
   */
  public async getTrackInfo(
    trackId: string
  ): Promise<{ success: boolean; track?: any; error?: string }> {
    // Record the request
    this.recordRequest('getTrackInfo', { trackId });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200));

    // Return success response
    return {
      success: true,
      track: {
        id: trackId,
        title: 'Mock Track',
        user: {
          username: 'Mock User'
        },
        permalink_url: `https://soundcloud.com/mock-user/mock-track-${trackId.substring(trackId.length - 6)}`,
        playback_count: 0,
        likes_count: 0,
        created_at: new Date().toISOString()
      }
    };
  }

  /**
   * Update track info
   */
  public async updateTrackInfo(
    trackId: string,
    metadata: Partial<SoundCloudMetadata>
  ): Promise<{ success: boolean; error?: string }> {
    // Record the request
    this.recordRequest('updateTrackInfo', { trackId, metadata });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 300));

    // Return success response
    return {
      success: true
    };
  }
}
