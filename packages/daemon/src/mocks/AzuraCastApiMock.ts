/**
 * AzuraCast API Mock
 * 
 * This mock simulates the AzuraCast API for testing purposes.
 * Focuses on upload and playlist functionality for development testing.
 */

import { DestinationApiMock } from './DestinationApiMock.js';
import * as fs from 'fs';
import { log } from '@uploadDistributor/logging';

export interface AzuraCastUploadResponse {
  success: boolean;
  id: string;
  path?: string;
  error?: string;
}

export interface AzuraCastMetadata {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
}

export class AzuraCastApiMock extends DestinationApiMock {
  private stationId: string;
  private playlistId: string;

  constructor(stationId: string = '2', playlistId: string = '1') {
    super('azuracast');
    this.stationId = stationId;
    this.playlistId = playlistId;
  }

  /**
   * Override the base authenticate method for upload testing
   */
  public override authenticate(): Promise<{ success: boolean; token: string }> {
    log('D:API   ', 'AZ:200', `[${this.destination}] Authentication stub called`);
    return Promise.resolve({ success: true, token: 'mock-token' });
  }
  
  /**
   * Upload a file to AzuraCast
   */
  public async uploadFile(
    filePath: string,
    metadata: AzuraCastMetadata
  ): Promise<AzuraCastUploadResponse> {
    // Validate required fields
    const isValid = this.validateRequiredFields(metadata, ['title', 'artist']);
    if (!isValid) {
      log('D:API   ', 'AZ:101', `Missing required metadata fields for uploadFile`);
      return {
        success: false,
        id: '',
        error: 'Missing required metadata fields'
      };
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      log('D:API   ', 'AZ:102', `File not found: ${filePath}`);
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
    
    log('D:API   ', 'AZ:103', `Request to uploadFile: ${JSON.stringify({
      file: `[Binary file: ${filePath}]`,
      metadata
    }, null, 2)}`);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return success response
    const fileId = `mock-azuracast-${Date.now()}`;
    return {
      success: true,
      id: fileId,
      path: `/var/azuracast/stations/${this.stationId}/files/${fileId}.mp3`
    };
  }

  /**
   * Set metadata for a file
   */
  public async setMetadata(
    fileId: string,
    metadata: AzuraCastMetadata
  ): Promise<{ success: boolean; error?: string }> {
    // Validate required fields
    const isValid = this.validateRequiredFields(metadata, ['title', 'artist']);
    if (!isValid) {
      log('D:API   ', 'AZ:104', `Missing required metadata fields for setMetadata`);
      return {
        success: false,
        error: 'Missing required metadata fields'
      };
    }

    // Record the request
    this.recordRequest('setMetadata', {
      fileId,
      metadata
    });
    
    log('D:API   ', 'AZ:105', `Request to setMetadata: ${JSON.stringify({
      fileId,
      metadata
    }, null, 2)}`);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200));

    // Return success response
    return {
      success: true
    };
  }

  /**
   * Add a file to a playlist
   */
  public async addToPlaylist(
    fileId: string,
    playlistName?: string
  ): Promise<{ success: boolean; playlistId: string; error?: string }> {
    // Use provided playlist name or default to the DJ name
    const playlist = playlistName || this.playlistId;

    // Record the request
    this.recordRequest('addToPlaylist', {
      fileId,
      playlistId: playlist
    });
    
    log('D:API   ', 'AZ:106', `Request to addToPlaylist: ${JSON.stringify({
      fileId,
      playlistId: playlist
    }, null, 2)}`);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200));

    // Return success response
    return {
      success: true,
      playlistId: playlist
    };
  }
}
