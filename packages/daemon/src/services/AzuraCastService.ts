/**
 * AzuraCast Service
 * 
 * This service handles uploads to AzuraCast using a hybrid approach:
 * - Real API calls for GETs (playlists, podcasts lookup)
 * - Mock API calls for POSTs (file upload, metadata, playlist scheduling)
 * 
 * Implements the 4-step upload process:
 * 1. Upload MP3 file with DJ subdirectory path
 * 2. Set metadata on the uploaded file
 * 3. Add file to DJ's playlist
 * 4. Schedule playlist for broadcast time
 */

import path from 'path';
import { AzuraCastApi } from '../apis/AzuraCastApi.js';
import { AzuraCastSftpApi } from '../apis/AzuraCastSftpApi.js';
import { AzuraCastApiMock, AzuraCastMetadata, AzuraCastUploadResponse } from '../mocks/AzuraCastApiMock.simple.js';
import { StatusManager } from './StatusManager.js';
import { retry, RetryOptions } from '../utils/RetryUtils.js';
import { SonglistData } from '../storage/SonglistStorage.js';
import { utcToCet } from '../utils/TimezoneUtils.js';
import { log, logError } from '@uploadDistributor/logging';

// Configuration
const STATION_ID = '2'; // Use station 2 for dev/test, station 1 for production

// IMPORTANT: To switch between mock and real API, comment/uncomment the appropriate sections
// in the uploadFile method below for each step of the upload process.

export class AzuraCastService {
  private realApi: AzuraCastApi;
  private sftpApi: AzuraCastSftpApi;
  private mockApi: AzuraCastApiMock;
  private statusManager: StatusManager;
  
  constructor(statusManager: StatusManager) {
    this.realApi = new AzuraCastApi();
    this.sftpApi = new AzuraCastSftpApi();
    this.mockApi = new AzuraCastApiMock(STATION_ID);
    this.statusManager = statusManager;
  }
  
  /**
   * Create AzuraCast metadata from a songlist
   * 
   * @param songlist The songlist data
   * @returns AzuraCast metadata object
   */
  public createMetadataFromSonglist(songlist: SonglistData): AzuraCastMetadata {
    // Convert UTC timestamps to CET
    const broadcastDate = songlist.broadcast_data.broadcast_date;
    const broadcastTime = songlist.broadcast_data.broadcast_time;
    const utcTimestamp = `${broadcastDate}T${broadcastTime}Z`;
    const cetTimestamp = utcToCet(utcTimestamp);
    const [cetDate] = cetTimestamp.split(' ');
    
    const baseTitle = songlist.broadcast_data.setTitle || 'Untitled Set';
    const djName = songlist.broadcast_data.DJ || 'Unknown DJ';
    
    // Create title with DJ name appended in parentheses
    const titleWithDj = `${baseTitle} (${djName})`;
    
    const metadata = {
      title: titleWithDj,
      artist: djName,
      album: titleWithDj,  // Album is same as title (including DJ name)
      genre: Array.isArray(songlist.broadcast_data.genre) ? 
             songlist.broadcast_data.genre.join(', ') || 'Radio Show' : 
             songlist.broadcast_data.genre || 'Radio Show'
    };
    
    log('D:API   ', 'AZ:001', `Created metadata: "${metadata.title}" by ${metadata.artist} (${metadata.genre})`);
    
    return metadata;
  }
  
  /**
   * Find DJ playlist using real API
   * 
   * @param djName The DJ name to find playlist for
   * @returns Promise with playlist info or error
   */
  private async findDjPlaylist(djName: string): Promise<{ success: boolean; playlist?: any; error?: string }> {
    try {
      // CHOOSE ONE APPROACH (comment out the other):
      
      // APPROACH 1: Use mock for playlist lookup
      /*
      const playlistsResult = await this.mockApi.getPlaylists();
      if (!playlistsResult.success) {
        return { success: false, error: playlistsResult.error };
      }
      
      const playlist = this.mockApi.findPlaylistByDjName(djName);
      if (!playlist) {
        return { success: false, error: `No playlist found for DJ: ${djName}` };
      }
      
      log('D:API   ', 'AZ:002', `Found DJ playlist: ${playlist.name} (ID: ${playlist.id})`);
      return { success: true, playlist };
      */
      
      // APPROACH 2: Use real API for playlist lookup
      const playlistsResult = await this.realApi.getPlaylists(STATION_ID);
      if (!playlistsResult.success) {
        return { success: false, error: playlistsResult.error };
      }
      
      // Find playlist by DJ name (case-insensitive matching)
      const djNameLower = djName.toLowerCase();
      const playlist = playlistsResult.playlists?.find(p => {
        const playlistNameLower = p.name.toLowerCase();
        return playlistNameLower === djNameLower || 
               playlistNameLower.includes(djNameLower) ||
               djNameLower.includes(playlistNameLower);
      });
      
      if (!playlist) {
        return { success: false, error: `No playlist found for DJ: ${djName}` };
      }
      
      log('D:API   ', 'AZ:002', `Found DJ playlist: ${playlist.name} (ID: ${playlist.id})`);
      return { success: true, playlist };
    } catch (error) {
      logError('ERROR   ', 'AZ:003', `Error finding DJ playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Convert time string to HHMM integer format (as required by AzuraCast API)
   * 
   * @param timeString The time in HH:MM or HH:MM:SS format
   * @returns Time as HHMM integer (e.g., "14:30" -> 1430)
   */
  private timeStringToHHMM(timeString: string): number {
    const timeParts = timeString.split(':').map(Number);
    const hours = timeParts[0] || 0;
    const minutes = timeParts[1] || 0;
    return hours * 100 + minutes;
  }

  /**
   * Calculate end time (broadcast time + 1 hour) in HHMM integer format
   * 
   * @param broadcastTime The broadcast time in HH:MM:SS format
   * @returns End time as HHMM integer
   */
  private calculateEndTimeHHMM(broadcastTime: string): number {
    const timeParts = broadcastTime.split(':').map(Number);
    const hours = timeParts[0] || 0;
    const minutes = timeParts[1] || 0;
    const endHours = (hours + 1) % 24; // Handle midnight rollover
    return endHours * 100 + minutes;
  }

  /**
   * Calculate end time (broadcast time + 1 hour)
   * 
   * @param broadcastTime The broadcast time in HH:MM:SS format
   * @returns End time in HH:MM:SS format
   */
  private calculateEndTime(broadcastTime: string): string {
    const timeParts = broadcastTime.split(':').map(Number);
    const hours = timeParts[0] || 0;
    const minutes = timeParts[1] || 0;
    const seconds = timeParts[2] || 0;
    const endHours = (hours + 1) % 24; // Handle midnight rollover
    return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  /**
   * Upload a file to AzuraCast with retry logic
   * Implements the new 4-step hybrid SFTP/API upload process as per AzuraCast-upload-flow.md
   */
  public async uploadFile(
    audioFilePath: string, 
    metadata: AzuraCastMetadata,
    songlist: SonglistData
  ): Promise<{ success: boolean; id?: string; path?: string; error?: string }> {
    log('D:WORKER', 'AZ:004', `Starting AzuraCast SFTP upload: "${metadata.title}" by ${metadata.artist}`);
    
    // Find DJ playlist
    const playlistResult = await this.findDjPlaylist(metadata.artist);
    
    if (!playlistResult.success) {
      logError('ERROR   ', 'AZ:005', `Failed to find DJ playlist: ${playlistResult.error}`);
      this.statusManager.logError(
        'azuracast',
        metadata.title,
        playlistResult.error || 'Failed to find DJ playlist',
        'UNKNOWN',
        { audioFilePath, metadata }
      );
      return {
        success: false,
        error: playlistResult.error || 'Failed to find DJ playlist'
      };
    }
    
    const djPlaylist = playlistResult.playlist;
    
    // Define retry options
    const retryOptions: RetryOptions = {
      maxRetries: 2,
      initialDelay: 1000,
      backoffFactor: 2,
      onRetry: (attempt, error, delay) => {
        log('D:API   ', 'AZ:S12', `AzuraCast operation failed, retrying in ${delay/1000}s... (${attempt}/${retryOptions.maxRetries})`);
        logError('ERROR   ', 'AZ:S13', `AzuraCast operation failed: ${error.message}`);
      }
    };
    
    try {
      // Step 1: SFTP Upload of .mp3 media file (no retry - upload once)
      log('D:SFTP  ', 'AZ:006', 'Step 1: Uploading file via SFTP to AzuraCast...');
      const djName = metadata.artist.toLowerCase().replace(/\s+/g, '_');
      const fileName = path.basename(audioFilePath);
      const destinationPath = `${djName}/${fileName}`;
      
      // Upload via SFTP (single attempt)
      const sftpResult = await this.sftpApi.uploadFile(audioFilePath, djName, fileName);
      
      if (!sftpResult.success) {
        this.statusManager.logError(
          'azuracast',
          metadata.title,
          sftpResult.error || 'SFTP upload failed',
          'UNKNOWN',
          { audioFilePath, metadata, djName, fileName }
        );
        return {
          success: false,
          error: sftpResult.error || 'SFTP upload failed'
        };
      }
      
      log('D:SFTP  ', 'AZ:007', `SFTP upload completed: ${sftpResult.remotePath}`);
      
      // Steps 2-4: API operations with retry logic
      const result = await retry(async () => {
        // Step 2: API File Discovery with enhanced retry logic
        log('D:API   ', 'AZ:008', 'Step 2: Discovering uploaded file via API...');
        
        let fileDiscoveryResult: { success: boolean; file?: any; error?: string } = { success: false };
        
        // Try discovery with progressive delays (3 attempts: 3s, 4s, 5s)
        for (let attempt = 1; attempt <= 3; attempt++) {
          const delay = 2000 + (attempt * 1000); // 3s, 4s, 5s
          log('D:API   ', 'AZ:008a', `Discovery attempt ${attempt}: Waiting ${delay/1000}s for AzuraCast to index the file...`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          fileDiscoveryResult = await this.realApi.findFileByPath(STATION_ID, destinationPath);
          
          if (fileDiscoveryResult.success && fileDiscoveryResult.file) {
            log('D:API   ', 'AZ:008b', `✅ File discovered on attempt ${attempt}: ID ${fileDiscoveryResult.file.id}`);
            break;
          } else {
            log('D:API   ', 'AZ:008c', `❌ Discovery attempt ${attempt} failed: ${fileDiscoveryResult.error}`);
            if (attempt === 3) {
              // Log the upload success even if discovery fails
              this.statusManager.logSuccess(
                'azuracast',
                metadata.title,
                `SFTP upload completed to ${sftpResult.remotePath} (file discovery failed after 3 attempts)`
              );
              
              this.statusManager.logError(
                'azuracast',
                metadata.title,
                fileDiscoveryResult.error || 'Failed to find uploaded file after 3 attempts',
                'UNKNOWN',
                { destinationPath, sftpPath: sftpResult.remotePath, attempts: 3 }
              );
              throw new Error(fileDiscoveryResult.error || 'Failed to find uploaded file after 3 attempts');
            }
          }
        }
        
        if (!fileDiscoveryResult.success || !fileDiscoveryResult.file) {
          throw new Error('File discovery failed unexpectedly');
        }
        
        const discoveredFile = fileDiscoveryResult.file;
        log('D:API   ', 'AZ:009', `File discovered: ID ${discoveredFile.id}, path: ${discoveredFile.path}`);
        
        // Step 3: API Metadata and Playlist Association
        log('D:API   ', 'AZ:010', `Step 3: Setting metadata and playlist (File ID: ${discoveredFile.id})`);
        
        const metadataAndPlaylistResult = await this.realApi.setMetadataAndPlaylist(
          discoveredFile.id, 
          metadata, 
          [djPlaylist.id], 
          STATION_ID
        );
        
        if (!metadataAndPlaylistResult.success) {
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            metadataAndPlaylistResult.error || 'Failed to set metadata and playlist',
            'UNKNOWN',
            { trackId: discoveredFile.id, metadata, playlistId: djPlaylist.id }
          );
          throw new Error(metadataAndPlaylistResult.error || 'Failed to set metadata and playlist');
        }
        
        // Step 4: API Playlist Scheduling
        const broadcastDate = songlist.broadcast_data.broadcast_date;
        const broadcastTime = songlist.broadcast_data.broadcast_time;
        const endTime = this.calculateEndTime(broadcastTime);
        const startTimeHHMM = this.timeStringToHHMM(broadcastTime);
        const endTimeHHMM = this.calculateEndTimeHHMM(broadcastTime);
        
        log('D:API   ', 'AZ:011', `Step 4: Scheduling playlist for ${broadcastDate} ${broadcastTime}-${endTime} (HHMM: ${startTimeHHMM} - ${endTimeHHMM})`);
        
        const scheduleItems = [{
          start_time: startTimeHHMM,
          end_time: endTimeHHMM,
          start_date: broadcastDate,
          end_date: broadcastDate,
          loop_once: true
        }];
        
        const scheduleResult = await this.realApi.schedulePlaylist(STATION_ID, djPlaylist.id, scheduleItems);
        
        if (!scheduleResult.success) {
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            scheduleResult.error || 'Failed to schedule playlist',
            'UNKNOWN',
            { playlistId: djPlaylist.id, scheduleItems }
          );
          throw new Error(scheduleResult.error || 'Failed to schedule playlist');
        }
        
        // All steps succeeded, return the result
        return {
          success: true,
          id: discoveredFile.id,
          path: sftpResult.remotePath
        };
      }, retryOptions);
      
      // Log success
      this.statusManager.logSuccess(
        'azuracast',
        metadata.title,
        `Uploaded via SFTP to ${result.path}`
      );
      
      log('D:WORKER', 'AZ:012', `SFTP upload completed successfully (ID: ${result.id})`);
      
      return {
        success: true,
        id: result.id,
        path: result.path
      };
    } catch (err) {
      // Final error after all retries
      this.statusManager.logError(
        'azuracast',
        metadata.title,
        (err as Error).message,
        'UNKNOWN',
        { audioFilePath, metadata }
      );
      logError('ERROR   ', 'AZ:S27', `AzuraCast SFTP upload failed after all retries: ${(err as Error).message}`);
      
      return {
        success: false,
        error: (err as Error).message
      };
    }
  }

  /**
   * Schedule playlist for broadcast (separate method for when we have broadcast time)
   * 
   * @param playlistId The playlist ID
   * @param broadcastDate The broadcast date (YYYY-MM-DD)
   * @param broadcastTime The broadcast time (HH:MM:SS)
   * @returns Promise with result
   */
  public async schedulePlaylist(
    playlistId: string,
    broadcastDate: string,
    broadcastTime: string
  ): Promise<{ success: boolean; error?: string }> {
    log('D:API   ', 'AZ:S26', `Scheduling playlist ${playlistId} for ${broadcastDate} at ${broadcastTime}`);
    
    try {
      const startTimeHHMM = this.timeStringToHHMM(broadcastTime);
      const endTimeHHMM = this.calculateEndTimeHHMM(broadcastTime);
      const endTime = this.calculateEndTime(broadcastTime);
      
      const scheduleItems = [{
        start_time: startTimeHHMM,
        end_time: endTimeHHMM,
        start_date: broadcastDate,
        end_date: broadcastDate,
        loop_once: true
      }];
      
      let scheduleResult: { success: boolean; error?: string };
      
      // CHOOSE ONE APPROACH (comment out the other):
      
      // APPROACH 1: Use Mock API for scheduling
      /*
      log('D:API   ', 'AZ:S26c', 'Using MOCK AzuraCast API for scheduling');
      log('D:API   ', 'AZ:S26e', `Scheduling playlist with mock AzuraCast API: ID ${playlistId}`);
      scheduleResult = await this.mockApi.schedulePlaylist(STATION_ID, playlistId, scheduleItems);
      */
      
      // APPROACH 2: Use Real API for scheduling
      log('D:API   ', 'AZ:S26d', `Scheduling playlist with real AzuraCast API: ID ${playlistId}`);
      scheduleResult = await this.realApi.schedulePlaylist(STATION_ID, playlistId, scheduleItems);
      
      if (!scheduleResult.success) {
        logError('ERROR   ', 'AZ:S27', `Failed to schedule playlist: ${scheduleResult.error}`);
        return { success: false, error: scheduleResult.error };
      }
      
      log('D:API   ', 'AZ:S28', `Playlist scheduled successfully for ${broadcastDate} ${broadcastTime}-${endTime}`);
      return { success: true };
    } catch (error) {
      logError('ERROR   ', 'AZ:S29', `Error scheduling playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}
