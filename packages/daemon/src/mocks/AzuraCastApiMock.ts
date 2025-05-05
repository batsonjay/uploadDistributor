/**
 * AzuraCast API Mock
 * 
 * This mock simulates the AzuraCast API for testing purposes.
 */

import { DestinationApiMock } from './DestinationApiMock';
import * as fs from 'fs';

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
   * Upload a file to AzuraCast
   */
  public async uploadFile(
    filePath: string,
    metadata: AzuraCastMetadata
  ): Promise<AzuraCastUploadResponse> {
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

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200));

    // Return success response
    return {
      success: true,
      playlistId: playlist
    };
  }
}
