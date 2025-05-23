/**
 * SoundCloud API Mock
 * 
 * This mock simulates the SoundCloud API for testing purposes.
 */

import { DestinationApiMock } from './DestinationApiMock.js';
import * as fs from 'fs';

export interface SoundCloudUploadResponse {
  success: boolean;
  id: string;
  permalink_url?: string;
  error?: string;
}

export interface SoundCloudMetadata {
  title: string;
  artist: string;
  description?: string;
  genre?: string;
  tag_list?: string;
  sharing: 'public' | 'private';
  artwork?: string;
}

export class SoundCloudApiMock extends DestinationApiMock {
  constructor() {
    super('soundcloud');
  }
  
  /**
   * Upload a file to SoundCloud (Step 1)
   */
  public async uploadFile(
    filePath: string,
    metadata: SoundCloudMetadata
  ): Promise<SoundCloudUploadResponse> {
    // Validate required fields
    const isValid = this.validateRequiredFields(metadata, ['title', 'artist', 'sharing']);
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
    
    // Check if artwork is provided (required for SoundCloud)
    if (!metadata.artwork) {
      return {
        success: false,
        id: '',
        error: 'Artwork is required for SoundCloud uploads'
      };
    }
    
    // Record the request
    this.recordRequest('uploadFile', {
      file: `[Binary file: ${filePath}]`,
      metadata: {
        ...metadata,
        artwork: '[Artwork file reference]'
      }
    });
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Return success with track ID for step 2
    const trackId = `mock-soundcloud-${Date.now()}`;
    
    return {
      success: true,
      id: trackId
    };
  }
  
  /**
   * Update track metadata (Step 2)
   */
  public async updateTrackMetadata(
    trackId: string,
    metadata: SoundCloudMetadata
  ): Promise<SoundCloudUploadResponse> {
    // Validate track ID
    if (!trackId || !trackId.startsWith('mock-soundcloud-')) {
      return {
        success: false,
        id: trackId,
        error: 'Invalid track ID'
      };
    }
    
    // Record the request
    this.recordRequest('updateTrackMetadata', {
      trackId,
      metadata: {
        ...metadata,
        artwork: metadata.artwork ? '[Artwork file reference]' : undefined
      }
    });
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Return success
    return {
      success: true,
      id: trackId,
      permalink_url: `https://soundcloud.com/mock-user/${metadata.title.toLowerCase().replace(/\s+/g, '-')}`
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
