/**
 * AzuraCast SFTP API Client
 * 
 * This class provides SFTP upload functionality for AzuraCast file uploads.
 * Uses SFTP to bypass the API's base64 encoding limitations for large files.
 */

import SftpClient from 'ssh2-sftp-client';
import { log, logError } from '@uploadDistributor/logging';
import fs from 'fs';
import path from 'path';

// SFTP Configuration Constants
const SFTP_CONFIG = {
  host: 'radio.balearic-fm.com',
  port: 2022,
  username: 'daemon',
  password: 'Bale.8012',
  basePath: '' // User is chrooted to the files directory, so DJ dirs are at root level
};

export interface SftpUploadResult {
  success: boolean;
  remotePath?: string;
  error?: string;
}

export interface SftpUploadProgress {
  transferred: number;
  total: number;
  percentage: number;
}

export class AzuraCastSftpApi {
  private sftp: SftpClient;
  
  constructor() {
    this.sftp = new SftpClient();
  }
  
  /**
   * Test SFTP connection
   * 
   * @returns Promise with connection test result
   */
  public async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      log('D:SFTP  ', 'SF:001', `Testing SFTP connection to ${SFTP_CONFIG.host}:${SFTP_CONFIG.port}`);
      
      await this.sftp.connect({
        host: SFTP_CONFIG.host,
        port: SFTP_CONFIG.port,
        username: SFTP_CONFIG.username,
        password: SFTP_CONFIG.password,
        readyTimeout: 10000, // 10 second timeout
        retries: 1
      });
      
      // Test basic directory listing (use root if basePath is empty)
      await this.sftp.list(SFTP_CONFIG.basePath || '/');
      
      await this.sftp.end();
      
      log('D:SFTP  ', 'SF:002', 'SFTP connection test successful');
      return { success: true };
    } catch (error) {
      logError('ERROR   ', 'SF:003', `SFTP connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Ensure connection is closed
      try {
        await this.sftp.end();
      } catch (closeError) {
        // Ignore close errors during error handling
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SFTP connection error'
      };
    }
  }
  
  /**
   * Check if a DJ directory exists
   * 
   * @param djName The DJ name (directory name)
   * @returns Promise with directory existence result
   */
  public async checkDjDirectoryExists(djName: string): Promise<{ success: boolean; exists: boolean; error?: string }> {
    try {
      log('D:SFTP  ', 'SF:004', `Checking if DJ directory exists: ${djName}`);
      
      await this.sftp.connect({
        host: SFTP_CONFIG.host,
        port: SFTP_CONFIG.port,
        username: SFTP_CONFIG.username,
        password: SFTP_CONFIG.password,
        readyTimeout: 10000,
        retries: 1
      });
      
      const djDirectoryPath = SFTP_CONFIG.basePath ? `${SFTP_CONFIG.basePath}/${djName}` : djName;
      const exists = await this.sftp.exists(djDirectoryPath);
      
      await this.sftp.end();
      
      log('D:SFTP  ', 'SF:005', `DJ directory ${djName} ${exists ? 'exists' : 'does not exist'}`);
      return { success: true, exists: !!exists };
    } catch (error) {
      logError('ERROR   ', 'SF:006', `Error checking DJ directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      try {
        await this.sftp.end();
      } catch (closeError) {
        // Ignore close errors during error handling
      }
      
      return {
        success: false,
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Upload a file via SFTP
   * 
   * @param localFilePath The local file path to upload
   * @param djName The DJ name (directory name)
   * @param filename The target filename
   * @param onProgress Optional progress callback
   * @returns Promise with upload result
   */
  public async uploadFile(
    localFilePath: string,
    djName: string,
    filename: string,
    onProgress?: (progress: SftpUploadProgress) => void
  ): Promise<SftpUploadResult> {
    try {
      // Validate local file exists
      if (!fs.existsSync(localFilePath)) {
        const errorMsg = `Local file not found: ${localFilePath}`;
        logError('ERROR   ', 'SF:007', errorMsg);
        return { success: false, error: errorMsg };
      }
      
      const fileStats = fs.statSync(localFilePath);
      const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
      
      log('D:SFTP  ', 'SF:008', `Starting SFTP upload: ${filename} (${fileSizeMB} MB) to DJ directory: ${djName}`);
      
      // Connect to SFTP server
      await this.sftp.connect({
        host: SFTP_CONFIG.host,
        port: SFTP_CONFIG.port,
        username: SFTP_CONFIG.username,
        password: SFTP_CONFIG.password,
        readyTimeout: 10000,
        retries: 1
      });
      
      // Check if DJ directory exists
      const djDirectoryPath = SFTP_CONFIG.basePath ? `${SFTP_CONFIG.basePath}/${djName}` : djName;
      const djDirExists = await this.sftp.exists(djDirectoryPath);
      
      if (!djDirExists) {
        await this.sftp.end();
        const errorMsg = `DJ directory does not exist: ${djName}`;
        logError('ERROR   ', 'SF:009', errorMsg);
        return { success: false, error: errorMsg };
      }
      
      // Construct remote file path
      const remoteFilePath = `${djDirectoryPath}/${filename}`;
      
      log('D:SFTP  ', 'SF:010', `Uploading to remote path: ${remoteFilePath}`);
      
      // Set up progress tracking with periodic console logging
      let lastLoggedPercentage = 0;
      let lastLogTime = Date.now();
      const logInterval = 5000; // Log every 5 seconds
      
      this.sftp.on('upload', (info) => {
        const progress: SftpUploadProgress = {
          transferred: info.bytesTransferred,
          total: info.bytesTotal,
          percentage: Math.round((info.bytesTransferred / info.bytesTotal) * 100)
        };
        
        // Call user callback if provided
        if (onProgress) {
          onProgress(progress);
        }
        
        const now = Date.now();
        const timeSinceLastLog = now - lastLogTime;
        
        // Log progress every 5 seconds OR every 10% milestone
        if (timeSinceLastLog >= logInterval || 
            (progress.percentage >= lastLoggedPercentage + 10 && progress.percentage % 10 === 0)) {
          
          const transferredMB = (progress.transferred / (1024 * 1024)).toFixed(1);
          const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
          const speedMBps = timeSinceLastLog > 0 ? 
            ((progress.transferred - (lastLoggedPercentage * progress.total / 100)) / (1024 * 1024)) / (timeSinceLastLog / 1000) : 0;
          
          log('D:SFTP  ', 'SF:011', `Upload progress: ${progress.percentage}% (${transferredMB}MB / ${totalMB}MB) - ${speedMBps.toFixed(1)} MB/s`);
          
          lastLoggedPercentage = progress.percentage;
          lastLogTime = now;
        }
      });
      
      // Perform the upload
      await this.sftp.fastPut(localFilePath, remoteFilePath);
      
      // Clean up connection
      await this.sftp.end();
      
      log('D:SFTP  ', 'SF:012', `SFTP upload completed successfully: ${remoteFilePath}`);
      
      return {
        success: true,
        remotePath: remoteFilePath
      };
    } catch (error) {
      logError('ERROR   ', 'SF:013', `SFTP upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Ensure connection is closed
      try {
        await this.sftp.end();
      } catch (closeError) {
        // Ignore close errors during error handling
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown SFTP upload error'
      };
    }
  }
  
  /**
   * List files in a DJ directory
   * 
   * @param djName The DJ name (directory name)
   * @returns Promise with file listing result
   */
  public async listDjFiles(djName: string): Promise<{ success: boolean; files?: any[]; error?: string }> {
    try {
      log('D:SFTPDB', 'SF:014', `Listing files in DJ directory: ${djName}`);
      
      await this.sftp.connect({
        host: SFTP_CONFIG.host,
        port: SFTP_CONFIG.port,
        username: SFTP_CONFIG.username,
        password: SFTP_CONFIG.password,
        readyTimeout: 10000,
        retries: 1
      });
      
      const djDirectoryPath = SFTP_CONFIG.basePath ? `${SFTP_CONFIG.basePath}/${djName}` : djName;
      const files = await this.sftp.list(djDirectoryPath);
      
      await this.sftp.end();
      
      log('D:SFTPDB', 'SF:015', `Found ${files.length} files in DJ directory: ${djName}`);
      return { success: true, files };
    } catch (error) {
      logError('ERROR   ', 'SF:016', `Error listing DJ files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      try {
        await this.sftp.end();
      } catch (closeError) {
        // Ignore close errors during error handling
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
