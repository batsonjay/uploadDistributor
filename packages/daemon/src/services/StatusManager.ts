/**
 * Status Manager
 * 
 * This service handles status updates and logging for file processing.
 * It provides a centralized way to update status files and log events
 * for both file receiving and destination uploading.
 */

import * as fs from 'fs';
import * as path from 'path';
import { log, logError } from '@uploadDistributor/logging';

export interface StatusData {
  fileId: string;
  status: string;
  message: string;
  timestamp: string;
  destinations?: any;
  current_platform?: string;
}

export class StatusManager {
  private fileId: string;
  private statusFile: string;
  
  constructor(fileId: string) {
    this.fileId = fileId;
    log('D:STATDB', 'SM:001', `StatusManager initialized for fileId: ${fileId}`);
    
    // Define status file path
    // When running with ts-node, __dirname is /packages/daemon/src/services
    // When running compiled code, __dirname is /packages/daemon/dist/services
    // We need to handle both cases to ensure the path is correct
    let filesDir: string;
    
    if (process.env.RECEIVED_FILES_DIR) {
      filesDir = process.env.RECEIVED_FILES_DIR;
    } else {
      // Check if we're in src or dist directory
      const dirParts = path.dirname(new URL(import.meta.url).pathname).split(path.sep);
      const srcOrDistIndex = dirParts.findIndex(part => part === 'src' || part === 'dist');
      
      if (srcOrDistIndex !== -1) {
        // Go up to the daemon directory and then to received-files
        const daemonDir = dirParts.slice(0, srcOrDistIndex).join(path.sep);
        filesDir = path.join(daemonDir, 'received-files');
      } else {
        // Fallback to a relative path from current directory
        filesDir = path.join(path.dirname(new URL(import.meta.url).pathname), '../../../received-files');
      }
    }
    
    log('D:STATDB', 'SM:002', `Using files directory: ${filesDir}`);
    const fileDir = path.join(filesDir, this.fileId);
    this.statusFile = path.join(fileDir, 'status.json');
    log('D:STATDB', 'SM:003', `Status file path: ${this.statusFile}`);
  }
  
  /**
   * Update the status file
   */
  public updateStatus(status: string, message: string, destinations?: any): void {
    log('D:STATDB', 'SM:004', `Status updated: ${status} - ${message}`);
    
    const statusData: StatusData = {
      fileId: this.fileId,
      status,
      message,
      timestamp: new Date().toISOString()
    };
    
    if (destinations) {
      statusData.destinations = destinations;
    }
    
    try {
      fs.writeFileSync(this.statusFile, JSON.stringify(statusData, null, 2));
      log('D:STATDB', 'SM:005', `Status file updated: ${JSON.stringify(statusData, null, 2)}`);
    } catch (error) {
      logError('ERROR   ', 'SM:006', `Failed to update status file: ${this.statusFile}`, error);
    }
  }
  
  /**
   * Log a success event
   */
  public logSuccess(
    serviceName: string,
    title: string,
    message: string
  ): void {
    log('D:STATUS', 'SM:007', `${serviceName} success: ${title} - ${message}`);
  }
  
  /**
   * Log an error event
   */
  public logError(
    serviceName: string,
    title: string,
    errorMessage: string,
    errorCategory: 'AUTHENTICATION' | 'VALIDATION' | 'NETWORK' | 'SERVER' | 'UNKNOWN' = 'UNKNOWN',
    requestDetails: any = {},
    attempt: number = 1
  ): void {
    // Map error categories to log categories
    let logCategory: 'ERROR   ' | 'D:AUTH  ' | 'D:ROUTE ' | 'D:API   ' | 'D:SYSTEM' = 'ERROR   ';
    
    // Use more specific categories if available
    if (errorCategory === 'AUTHENTICATION') {
      logCategory = 'D:AUTH  ';
    } else if (errorCategory === 'VALIDATION') {
      logCategory = 'D:ROUTE ';
    } else if (errorCategory === 'NETWORK') {
      logCategory = 'D:API   ';
    } else if (errorCategory === 'SERVER') {
      logCategory = 'D:SYSTEM';
    }
    
    logError(logCategory, 'SM:008', `${serviceName} error: ${title} - ${errorMessage}`, {
      errorCategory,
      requestDetails,
      attempt
    });
  }
}
