/**
 * Status Manager
 * 
 * This service handles status updates and logging for upload processes.
 * It provides a centralized way to update status files and log events.
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
  logDestinationStatus, 
  logDetailedError, 
  LogType, 
  ErrorType 
} from '../utils/LoggingUtils';

export interface StatusData {
  status: string;
  message: string;
  timestamp: string;
  destinations?: any;
  current_platform?: string;
}

export class StatusManager {
  private uploadId: string;
  private statusFile: string;
  
  constructor(uploadId: string) {
    this.uploadId = uploadId;
    
    // Define status file path
    // When running with ts-node, __dirname is /packages/daemon/src/services
    // When running compiled code, __dirname is /packages/daemon/dist/services
    // We need to handle both cases to ensure the path is correct
    let uploadsDir: string;
    
    if (process.env.UPLOAD_DIR) {
      uploadsDir = process.env.UPLOAD_DIR;
    } else {
      // Check if we're in src or dist directory
      const dirParts = __dirname.split(path.sep);
      const srcOrDistIndex = dirParts.findIndex(part => part === 'src' || part === 'dist');
      
      if (srcOrDistIndex !== -1) {
        // Go up to the daemon directory and then to uploads
        const daemonDir = dirParts.slice(0, srcOrDistIndex).join(path.sep);
        uploadsDir = path.join(daemonDir, 'uploads');
      } else {
        // Fallback to a relative path from current directory
        uploadsDir = path.join(__dirname, '../../../uploads');
      }
    }
    
    process.stdout.write(`Using uploads directory: ${uploadsDir}\n`);
    const uploadDir = path.join(uploadsDir, uploadId);
    this.statusFile = path.join(uploadDir, 'status.json');
  }
  
  /**
   * Update the status file
   */
  public updateStatus(status: string, message: string, destinations?: any): void {
    const statusData: StatusData = {
      status,
      message,
      timestamp: new Date().toISOString()
    };
    
    if (destinations) {
      statusData.destinations = destinations;
    }
    
    fs.writeFileSync(this.statusFile, JSON.stringify(statusData, null, 2));
    process.stdout.write(`Status updated: ${status} - ${message}\n`);
  }
  
  /**
   * Log a success event
   */
  public logSuccess(
    serviceName: string,
    title: string,
    message: string
  ): void {
    logDestinationStatus(
      serviceName,
      LogType.SUCCESS,
      title,
      message
    );
  }
  
  /**
   * Log an error event
   */
  public logError(
    serviceName: string,
    title: string,
    errorMessage: string,
    errorType: ErrorType = ErrorType.UNKNOWN,
    requestDetails: any = {},
    attempt: number = 1
  ): void {
    logDestinationStatus(
      serviceName,
      LogType.ERROR,
      title,
      errorMessage
    );
    
    logDetailedError(
      serviceName,
      title,
      errorType,
      errorMessage,
      requestDetails,
      attempt
    );
  }
}
