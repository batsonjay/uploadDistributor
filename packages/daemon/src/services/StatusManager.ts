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
    // Log to console
    log('D:STATUS', 'SM:007', `${serviceName} success: ${title} - ${message}`);
    
    // Also log to destination-status.log
    this.logSuccessToDestinationFile(serviceName, title, message);
  }
  
  /**
   * Log success to destination status file
   */
  private logSuccessToDestinationFile(
    serviceName: string,
    title: string,
    message: string
  ): void {
    try {
      // Create logs directory if it doesn't exist
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Define log file
      const statusLogPath = path.join(logsDir, 'destination-status.log');
      
      // Create timestamp
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      
      // Format log entry
      const logEntry = `[${serviceName}]: success [${timestamp}]: ${title}, ${message}`;
      
      // Log to destination-status.log
      fs.appendFileSync(statusLogPath, logEntry + '\n');
      
      log('D:STATUS', 'SM:011', `Logged success to destination file: ${serviceName} - ${title}`);
    } catch (error) {
      logError('ERROR   ', 'SM:012', `Failed to log success to destination file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    
    // Log to console
    logError(logCategory, 'SM:008', `${serviceName} error: ${title} - ${errorMessage}`, {
      errorCategory,
      requestDetails,
      attempt
    });
    
    // Also log to destination-status.log and destination-errors.log
    this.logToDestinationFiles(serviceName, title, errorMessage, errorCategory, requestDetails, attempt);
  }
  
  /**
   * Log to destination status and error files
   */
  private logToDestinationFiles(
    serviceName: string,
    title: string,
    errorMessage: string,
    errorCategory: string,
    requestDetails: any = {},
    attempt: number = 1
  ): void {
    try {
      // Create logs directory if it doesn't exist
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      // Define log files
      const statusLogPath = path.join(logsDir, 'destination-status.log');
      const errorsLogPath = path.join(logsDir, 'destination-errors.log');
      
      // Create timestamp
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      
      // Format log entry
      const logEntry = `[${serviceName}]: error [${timestamp}]: ${title}, ${errorMessage}`;
      
      // Log to destination-status.log
      fs.appendFileSync(statusLogPath, logEntry + '\n');
      
      // Log to destination-errors.log with more details
      const detailedLogEntry = `[${serviceName}]: error [${timestamp}]: ${title}, ${errorMessage}\n` +
        `  Category: ${errorCategory}\n` +
        `  Attempt: ${attempt}\n` +
        `  Details: ${JSON.stringify(requestDetails)}\n`;
      
      fs.appendFileSync(errorsLogPath, detailedLogEntry + '\n');
      
      log('D:STATUS', 'SM:009', `Logged error to destination files: ${serviceName} - ${title}`);
    } catch (error) {
      logError('ERROR   ', 'SM:010', `Failed to log to destination files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
