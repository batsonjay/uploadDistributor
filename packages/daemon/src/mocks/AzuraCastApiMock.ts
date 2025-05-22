/**
 * AzuraCast API Mock
 * 
 * This mock simulates the AzuraCast API for testing purposes.
 * 
 * Password handling is done using simple XOR obfuscation to avoid plaintext passwords.
 */

import { DestinationApiMock } from './DestinationApiMock.js';
import * as fs from 'fs';
import { AuthService } from '../services/AuthService.js';

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
  private authService: AuthService;

  constructor(stationId: string = '2', playlistId: string = '1') {
    super('azuracast');
    this.stationId = stationId;
    this.playlistId = playlistId;
    this.authService = AuthService.getInstance();
  }

  /**
   * Authenticate with AzuraCast using credentials
   * 
   * @param email User email
   * @param password User password (plaintext)
   * @param encodedPassword User password (encoded with XOR)
   */
  /**
   * Authenticate with AzuraCast using email
   * 
   * @param email User email
   */
  public async authenticateWithEmail(
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    const result = await this.authService.authenticateWithEmail(email);
    
    this.recordRequest('authenticateWithEmail', {
      email
    });
    
    return {
      success: result.success,
      error: result.error
    };
  }
  
  /**
   * Verify a magic link token
   * 
   * @param token Magic link token
   */
  public async verifyMagicLinkToken(
    token: string
  ): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
    const result = await this.authService.verifyMagicLinkToken(token);
    
    this.recordRequest('verifyMagicLinkToken', {
      token: token.substring(0, 10) + '...'
    });
    
    return {
      success: result.success,
      token: result.token,
      user: result.user,
      error: result.error
    };
  }
  
  /**
   * Override the base authenticate method
   */
  public override authenticate(): Promise<{ success: boolean; token: string }> {
    process.stdout.write(`[${this.destination}] Authentication stub called\n`);
    return Promise.resolve({ success: true, token: 'mock-token' });
  }
  
  /**
   * Validate a token
   */
  public async validateToken(token: string): Promise<{ success: boolean; user?: any; error?: string }> {
    const result = await this.authService.validateToken(token);
    
    this.recordRequest('validateToken', {
      token: token.substring(0, 10) + '...'
    });
    
    return {
      success: result.success,
      user: result.user,
      error: result.error
    };
  }
  
  /**
   * Get user profile
   */
  public async getUserProfile(token: string): Promise<{ success: boolean; user?: any; error?: string }> {
    const result = await this.authService.validateToken(token);
    
    this.recordRequest('getUserProfile', {
      token: token.substring(0, 10) + '...'
    });
    
    return {
      success: result.success,
      user: result.user,
      error: result.error
    };
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
