/**
 * Simplified AzuraCast API Mock
 * 
 * This mock implements the 4-step AzuraCast upload process:
 * 1. Upload MP3 file
 * 2. Set metadata
 * 3. Add to DJ playlist
 * 4. Schedule playlist for broadcast
 */

import { DestinationApiMock } from './DestinationApiMock.js';
import { log, logError } from '@uploadDistributor/logging';
import * as fs from 'fs';
import * as path from 'path';

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
  private mockPlaylists: any[];
  private mockPodcasts: any[];
  private uploadedFiles: Map<string, any> = new Map();

  constructor(stationId: string = '2') {
    super('azuracast');
    this.stationId = stationId;
    
    // Mock playlists based on known DJs
    this.mockPlaylists = [
      { id: '1', name: 'catalyst' },
      { id: '2', name: 'DJ Takafusa' },
      { id: '3', name: 'Giugri.j' },
      { id: '4', name: 'podcast' }
    ];
    
    // Mock podcasts
    this.mockPodcasts = [
      { id: '1', title: 'Balearic FM Podcast', description: 'Weekly DJ sets from Balearic FM' }
    ];
  }

  /**
   * Get playlists for the station (real API call simulation)
   */
  public async getPlaylists(): Promise<{ success: boolean; playlists?: any[]; error?: string }> {
    log('D:API   ', 'AZ:M01', `Mock: Getting playlists for station ${this.stationId}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      playlists: this.mockPlaylists
    };
  }

  /**
   * Get podcasts for the station (real API call simulation)
   */
  public async getPodcasts(): Promise<{ success: boolean; podcasts?: any[]; error?: string }> {
    log('D:API   ', 'AZ:M02', `Mock: Getting podcasts for station ${this.stationId}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      success: true,
      podcasts: this.mockPodcasts
    };
  }

  /**
   * Step 1: Upload a file to AzuraCast
   */
  public async uploadFile(
    filePath: string,
    destinationPath: string
  ): Promise<AzuraCastUploadResponse> {
    log('D:API   ', 'AZ:M03', `Mock: Uploading file to ${destinationPath}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logError('ERROR   ', 'AZ:M04', `File not found: ${filePath}`);
      return {
        success: false,
        id: '',
        error: `File not found: ${filePath}`
      };
    }

    // Record the request
    this.recordRequest('uploadFile', {
      file: `[Binary file: ${path.basename(filePath)}]`,
      destinationPath
    });

    // Simulate processing time for file upload
    await new Promise(resolve => setTimeout(resolve, 800));

    // Generate mock file ID and construct path
    const fileId = `mock-azuracast-${Date.now()}`;
    const fullPath = `/var/azuracast/stations/${this.stationId}/files/${destinationPath}`;
    
    // Store uploaded file info for later steps
    this.uploadedFiles.set(fileId, {
      id: fileId,
      path: fullPath,
      destinationPath,
      originalFile: filePath
    });

    log('D:API   ', 'AZ:M05', `Mock: File uploaded successfully, ID: ${fileId}`);
    
    return {
      success: true,
      id: fileId,
      path: fullPath
    };
  }

  /**
   * Step 2: Set metadata and playlist association (combined call as per AzuraCast API)
   */
  public async setMetadataAndPlaylist(
    fileId: string,
    metadata: AzuraCastMetadata,
    playlistIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    log('D:API   ', 'AZ:M06', `Mock: Setting metadata and playlist association for file ${fileId}`);
    
    // Validate required fields
    const isValid = this.validateRequiredFields(metadata, ['title', 'artist']);
    if (!isValid) {
      logError('ERROR   ', 'AZ:M07', 'Missing required metadata fields');
      return {
        success: false,
        error: 'Missing required metadata fields'
      };
    }

    // Check if file exists in our mock storage
    if (!this.uploadedFiles.has(fileId)) {
      logError('ERROR   ', 'AZ:M08', `File ID ${fileId} not found`);
      return {
        success: false,
        error: `File ID ${fileId} not found`
      };
    }

    // Validate playlist IDs
    const validPlaylists = [];
    for (const playlistId of playlistIds) {
      const playlist = this.mockPlaylists.find(p => p.id === playlistId);
      if (!playlist) {
        logError('ERROR   ', 'AZ:M09', `Playlist ID ${playlistId} not found`);
        return {
          success: false,
          error: `Playlist ID ${playlistId} not found`
        };
      }
      validPlaylists.push(playlist);
    }

    // Record the request with correct API structure
    this.recordRequest('setMetadataAndPlaylist', {
      fileId,
      ...metadata,
      playlist: playlistIds
    });

    // Update stored file info with metadata and playlist associations
    const fileInfo = this.uploadedFiles.get(fileId);
    fileInfo.metadata = metadata;
    fileInfo.playlistIds = playlistIds;
    fileInfo.playlistNames = validPlaylists.map(p => p.name);
    this.uploadedFiles.set(fileId, fileInfo);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 300));

    log('D:API   ', 'AZ:M10', `Mock: Metadata and playlist association set successfully for ${metadata.title} by ${metadata.artist}`);
    log('D:API   ', 'AZ:M11', `Mock: Associated with playlists: ${validPlaylists.map(p => p.name).join(', ')}`);
    
    return {
      success: true
    };
  }

  /**
   * Legacy method: Set metadata for a file (kept for backward compatibility)
   */
  public async setMetadata(
    fileId: string,
    metadata: AzuraCastMetadata
  ): Promise<{ success: boolean; error?: string }> {
    log('D:API   ', 'AZ:M12', `Mock: Setting metadata for file ${fileId} (legacy method)`);
    return this.setMetadataAndPlaylist(fileId, metadata, []);
  }

  /**
   * Legacy method: Add a file to a playlist (kept for backward compatibility)
   */
  public async addToPlaylist(
    stationId: string,
    playlistId: string,
    mediaId: string
  ): Promise<{ success: boolean; error?: string }> {
    log('D:API   ', 'AZ:M13', `Mock: Adding media ${mediaId} to playlist ${playlistId} (legacy method)`);
    
    // Check if file exists in our mock storage
    if (!this.uploadedFiles.has(mediaId)) {
      logError('ERROR   ', 'AZ:M14', `Media ID ${mediaId} not found`);
      return {
        success: false,
        error: `Media ID ${mediaId} not found`
      };
    }

    // Check if playlist exists
    const playlist = this.mockPlaylists.find(p => p.id === playlistId);
    if (!playlist) {
      logError('ERROR   ', 'AZ:M15', `Playlist ID ${playlistId} not found`);
      return {
        success: false,
        error: `Playlist ID ${playlistId} not found`
      };
    }

    // Record the request
    this.recordRequest('addToPlaylist', {
      stationId,
      playlistId,
      mediaId,
      playlistName: playlist.name
    });

    // Update stored file info
    const fileInfo = this.uploadedFiles.get(mediaId);
    if (!fileInfo.playlistIds) {
      fileInfo.playlistIds = [];
      fileInfo.playlistNames = [];
    }
    if (!fileInfo.playlistIds.includes(playlistId)) {
      fileInfo.playlistIds.push(playlistId);
      fileInfo.playlistNames.push(playlist.name);
    }
    this.uploadedFiles.set(mediaId, fileInfo);

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 300));

    log('D:API   ', 'AZ:M16', `Mock: Media added to playlist "${playlist.name}" successfully`);
    
    return {
      success: true
    };
  }

  /**
   * Step 4: Schedule a playlist
   */
  public async schedulePlaylist(
    stationId: string,
    playlistId: string,
    scheduleItems: any[]
  ): Promise<{ success: boolean; error?: string }> {
    log('D:API   ', 'AZ:M14', `Mock: Scheduling playlist ${playlistId} with ${scheduleItems.length} items`);
    
    // Check if playlist exists
    const playlist = this.mockPlaylists.find(p => p.id === playlistId);
    if (!playlist) {
      logError('ERROR   ', 'AZ:M15', `Playlist ID ${playlistId} not found`);
      return {
        success: false,
        error: `Playlist ID ${playlistId} not found`
      };
    }

    // Validate schedule items
    for (const item of scheduleItems) {
      if (!item.start_date || !item.start_time || !item.end_time) {
        logError('ERROR   ', 'AZ:M16', 'Invalid schedule item format');
        return {
          success: false,
          error: 'Invalid schedule item format'
        };
      }
    }

    // Record the request
    this.recordRequest('schedulePlaylist', {
      stationId,
      playlistId,
      playlistName: playlist.name,
      scheduleItems
    });

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 400));

    log('D:API   ', 'AZ:M17', `Mock: Playlist "${playlist.name}" scheduled successfully`);
    
    return {
      success: true
    };
  }

  /**
   * Find playlist by DJ name
   */
  public findPlaylistByDjName(djName: string): any | null {
    const djNameLower = djName.toLowerCase();
    
    return this.mockPlaylists.find(playlist => {
      const playlistNameLower = playlist.name.toLowerCase();
      
      // Exact match
      if (playlistNameLower === djNameLower) {
        return true;
      }
      
      // Handle "DJ " prefix
      if (djNameLower.startsWith('dj ') && playlistNameLower === djNameLower) {
        return true;
      }
      
      // Handle case variations
      if (djNameLower === 'catalyst' && playlistNameLower === 'catalyst') {
        return true;
      }
      
      if (djNameLower === 'giugri.j' && playlistNameLower === 'giugri.j') {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Get uploaded file info (for debugging)
   */
  public getUploadedFileInfo(fileId: string): any | null {
    return this.uploadedFiles.get(fileId) || null;
  }

  /**
   * Reset mock state
   */
  public override reset(): void {
    super.reset();
    this.uploadedFiles.clear();
    log('D:API   ', 'AZ:M18', 'Mock: State reset, uploaded files cleared');
  }
}
