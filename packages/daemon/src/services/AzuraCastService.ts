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
  private mockApi: AzuraCastApiMock;
  private statusManager: StatusManager;
  
  constructor(statusManager: StatusManager) {
    this.realApi = new AzuraCastApi();
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
    log('D:API   ', 'AZ:S01', `Creating metadata from songlist for ${songlist.broadcast_data.DJ || 'Unknown DJ'}`);
    
    // Convert UTC timestamps to CET
    const broadcastDate = songlist.broadcast_data.broadcast_date;
    const broadcastTime = songlist.broadcast_data.broadcast_time;
    const utcTimestamp = `${broadcastDate}T${broadcastTime}Z`;
    const cetTimestamp = utcToCet(utcTimestamp);
    const [cetDate] = cetTimestamp.split(' ');
    
    const metadata = {
      title: songlist.broadcast_data.setTitle || 'Untitled Set',
      artist: songlist.broadcast_data.DJ || 'Unknown DJ',
      album: `${cetDate || new Date().toISOString().split('T')[0]} Broadcast`,
      genre: Array.isArray(songlist.broadcast_data.genre) ? 
             songlist.broadcast_data.genre.join(', ') || 'Radio Show' : 
             songlist.broadcast_data.genre || 'Radio Show'
    };
    
    log('D:API   ', 'AZ:S02', `Metadata created: ${metadata.title} by ${metadata.artist}, genre: ${metadata.genre}`);
    
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
      log('D:API   ', 'AZ:S03', `Looking up playlist for DJ: ${djName}`);
      
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
      
      log('D:API   ', 'AZ:S04', `Found playlist: ${playlist.name} (ID: ${playlist.id})`);
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
      
      log('D:API   ', 'AZ:S05', `Found playlist: ${playlist.name} (ID: ${playlist.id})`);
      return { success: true, playlist };
    } catch (error) {
      logError('ERROR   ', 'AZ:S06', `Error finding DJ playlist: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Convert time string to minutes from midnight (as required by AzuraCast API)
   * 
   * @param timeString The time in HH:MM or HH:MM:SS format
   * @returns Minutes from midnight as integer
   */
  private timeStringToMinutes(timeString: string): number {
    const timeParts = timeString.split(':').map(Number);
    const hours = timeParts[0] || 0;
    const minutes = timeParts[1] || 0;
    return hours * 60 + minutes;
  }

  /**
   * Calculate end time (broadcast time + 1 hour) in minutes from midnight
   * 
   * @param broadcastTime The broadcast time in HH:MM:SS format
   * @returns End time in minutes from midnight
   */
  private calculateEndTimeMinutes(broadcastTime: string): number {
    const startMinutes = this.timeStringToMinutes(broadcastTime);
    const endMinutes = (startMinutes + 60) % (24 * 60); // Handle midnight rollover
    return endMinutes;
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
   * Implements the correct 3-step upload process as per AzuraCast-upload-flow.md
   */
  public async uploadFile(
    audioFilePath: string, 
    metadata: AzuraCastMetadata,
    songlist: SonglistData
  ): Promise<{ success: boolean; id?: string; path?: string; error?: string }> {
    log('D:WORKER', 'AZ:S07', 'Starting AzuraCast upload process...');
    log('D:FILE  ', 'AZ:S08', `File: ${path.basename(audioFilePath)}`);
    
    // Pre-upload: Find DJ playlist
    log('D:API   ', 'AZ:S09', 'Pre-upload: Finding DJ playlist...');
    const playlistResult = await this.findDjPlaylist(metadata.artist);
    
    if (!playlistResult.success) {
      logError('ERROR   ', 'AZ:S10', `Failed to find DJ playlist: ${playlistResult.error}`);
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
    log('D:API   ', 'AZ:S11', `Found DJ playlist: ${djPlaylist.name} (ID: ${djPlaylist.id})`);
    
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
      // Use the retry utility to handle the entire upload process
      const result = await retry(async () => {
        // Step 1: Upload the .mp3 media file
        log('D:API   ', 'AZ:S14', 'Step 1: Uploading .mp3 media file...');
        const djName = metadata.artist.toLowerCase().replace(/\s+/g, '_');
        const fileName = path.basename(audioFilePath);
        const destinationPath = `${djName}/${fileName}`;
        const expectedFullPath = `/var/azuracast/stations/${STATION_ID}/files/${destinationPath}`;
        
        log('D:FILE  ', 'AZ:S15', `REMOTE destination path: ${destinationPath}`);
        log('D:FILE  ', 'AZ:S16', `Expected REMOTE full path: ${expectedFullPath}`);
        
        let uploadResult: AzuraCastUploadResponse;
        
        // CHOOSE ONE APPROACH (comment out the other):
        
        // APPROACH 1: Use Mock API for file upload
        /*
        log('D:API   ', 'AZ:S14c', 'Using MOCK AzuraCast API for file upload');
        log('D:API   ', 'AZ:S14h', `Uploading file to mock AzuraCast API: ${path.basename(audioFilePath)}`);
        uploadResult = await this.mockApi.uploadFile(audioFilePath, destinationPath);
        */
        
        // APPROACH 2: Use Real API for file upload
        log('D:API   ', 'AZ:S14d', `Uploading LOCAL file to real AzuraCast API: ${path.basename(audioFilePath)}`);
        try {
          const realUploadResult = await this.realApi.uploadFile(audioFilePath, destinationPath, STATION_ID);
          uploadResult = {
            success: realUploadResult.success,
            id: realUploadResult.id || '',
            path: realUploadResult.path,
            error: realUploadResult.error
          };
          
          if (uploadResult.success) {
            log('D:API   ', 'AZ:S14e', `Real API file upload successful. File ID: ${uploadResult.id}, Path: ${uploadResult.path}`);
          } else {
            logError('ERROR   ', 'AZ:S14f', `Real API file upload failed: ${uploadResult.error}`);
          }
        } catch (uploadError) {
          logError('ERROR   ', 'AZ:S14g', `Exception during real API file upload: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          uploadResult = {
            success: false,
            id: '',
            error: uploadError instanceof Error ? uploadError.message : 'Unknown upload error'
          };
        }
        
        if (!uploadResult.success) {
          logError('ERROR   ', 'AZ:S17', `Failed to upload file to AzuraCast: ${uploadResult.error || 'Unknown error'}`);
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            uploadResult.error || 'Unknown error',
            'UNKNOWN',
            { audioFilePath, metadata }
          );
          throw new Error(uploadResult.error || 'Upload failed');
        }
        
        log('D:API   ', 'AZ:S18', `File uploaded successfully, media ID: ${uploadResult.id}`);
        
        // Step 2: Send metadata and playlist association (combined in single call)
        log('D:API   ', 'AZ:S19', 'Step 2: Setting metadata and playlist association...');
        
        let metadataAndPlaylistResult: { success: boolean; error?: string };
        
        // CHOOSE ONE APPROACH (comment out the other):
        
        // APPROACH 1: Use Mock API for metadata
        /*
        log('D:API   ', 'AZ:S19c', 'Using MOCK AzuraCast API for metadata');
        log('D:API   ', 'AZ:S19e', `Setting metadata with mock AzuraCast API for file ID: ${uploadResult.id}`);
        metadataAndPlaylistResult = await this.mockApi.setMetadataAndPlaylist(uploadResult.id, metadata, [djPlaylist.id]);
        */
        
        // APPROACH 2: Use Real API for metadata
        log('D:API   ', 'AZ:S19d', `Setting metadata with real AzuraCast API for file ID: ${uploadResult.id}`);
        metadataAndPlaylistResult = await this.realApi.setMetadataAndPlaylist(uploadResult.id, metadata, [djPlaylist.id], STATION_ID);
        
        if (!metadataAndPlaylistResult.success) {
          logError('ERROR   ', 'AZ:S20', `Failed to set metadata and playlist in AzuraCast: ${metadataAndPlaylistResult.error || 'Unknown error'}`);
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            metadataAndPlaylistResult.error || 'Failed to set metadata and playlist',
            'UNKNOWN',
            { trackId: uploadResult.id, metadata, playlistId: djPlaylist.id }
          );
          throw new Error(metadataAndPlaylistResult.error || 'Failed to set metadata and playlist');
        }
        
        log('D:API   ', 'AZ:S21', 'Metadata and playlist association set successfully');
        
        // Step 3: Set Playback Time on Playlist
        log('D:API   ', 'AZ:S22', 'Step 3: Setting playback time on playlist...');
        
        const broadcastDate = songlist.broadcast_data.broadcast_date;
        const broadcastTime = songlist.broadcast_data.broadcast_time;
        const startTimeMinutes = this.timeStringToMinutes(broadcastTime);
        const endTimeMinutes = this.calculateEndTimeMinutes(broadcastTime);
        
        const scheduleItems = [{
          start_date: broadcastDate,
          start_time: startTimeMinutes,
          end_time: endTimeMinutes,
          loop_once: true
        }];
        
        let scheduleResult: { success: boolean; error?: string };
        
        // CHOOSE ONE APPROACH (comment out the other):
        
        // APPROACH 1: Use Mock API for scheduling
        /*
        log('D:API   ', 'AZ:S22c', 'Using MOCK AzuraCast API for scheduling');
        log('D:API   ', 'AZ:S22e', `Scheduling playlist with mock AzuraCast API: ${djPlaylist.name} (ID: ${djPlaylist.id})`);
        scheduleResult = await this.mockApi.schedulePlaylist(STATION_ID, djPlaylist.id, scheduleItems);
        */
        
        // APPROACH 2: Use Real API for scheduling
        log('D:API   ', 'AZ:S22d', `Scheduling playlist with real AzuraCast API: ${djPlaylist.name} (ID: ${djPlaylist.id})`);
        scheduleResult = await this.realApi.schedulePlaylist(STATION_ID, djPlaylist.id, scheduleItems);
        
        if (!scheduleResult.success) {
          logError('ERROR   ', 'AZ:S23', `Failed to schedule playlist: ${scheduleResult.error}`);
          this.statusManager.logError(
            'azuracast',
            metadata.title,
            scheduleResult.error || 'Failed to schedule playlist',
            'UNKNOWN',
            { playlistId: djPlaylist.id, scheduleItems }
          );
          throw new Error(scheduleResult.error || 'Failed to schedule playlist');
        }
        
        const endTime = this.calculateEndTime(broadcastTime);
        log('D:API   ', 'AZ:S24', `Playlist scheduled successfully for ${broadcastDate} ${broadcastTime}-${endTime}`);
        
        // All steps succeeded, return the result
        return uploadResult;
      }, retryOptions);
      
      // Log success
      this.statusManager.logSuccess(
        'azuracast',
        metadata.title,
        `Uploaded to ${result.path}`
      );
      
      log('D:WORKER', 'AZ:S25', 'AzuraCast upload completed successfully');
      log('D:STATUS', 'AZ:S26', `File ID: ${result.id}, Path: ${result.path}`);
      
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
      logError('ERROR   ', 'AZ:S27', `AzuraCast upload failed after all retries: ${(err as Error).message}`);
      
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
      const startTimeMinutes = this.timeStringToMinutes(broadcastTime);
      const endTimeMinutes = this.calculateEndTimeMinutes(broadcastTime);
      const endTime = this.calculateEndTime(broadcastTime);
      
      const scheduleItems = [{
        start_date: broadcastDate,
        start_time: startTimeMinutes,
        end_time: endTimeMinutes,
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
