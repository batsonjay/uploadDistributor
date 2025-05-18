/**
 * Logging Utilities
 * 
 * This module provides utilities for logging across the application:
 * 1. Destination logging: Status and errors for destination uploads
 * 2. Parser logging: Standardized logging for all parsers
 * 
 * The logging system supports different verbosity levels controlled by environment variables:
 * - LOG_LEVEL: error, warning, info, debug (default: info)
 * - LOG_TO_FILE: true, false (default: false)
 */

import * as fs from 'fs';
import * as path from 'path';

// Define log file paths
const logsDir = process.env.LOGS_DIR || path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '../../logs'
);
const successErrorLogFile = path.join(logsDir, 'destination-status.log');
const detailedErrorLogFile = path.join(logsDir, 'destination-errors.log');
const parserLogFile = path.join(logsDir, 'parser-events.log');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log types
export enum LogType {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info'
}

// Error types
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  NETWORK = 'network',
  SERVER = 'server',
  UNKNOWN = 'unknown'
}

// Parser log types
export enum ParserLogType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  DEBUG = 'debug'
}

// Upload stages for progress tracking
export enum UploadStage {
  INIT = 'initialization',
  METADATA = 'metadata',
  UPLOAD = 'upload',
  FINALIZE = 'finalization'
}

/**
 * Log destination status (success or error) to the status log
 * Format: [service-name]: [success | error] [yyyy-mm-dd hh:mm]: songfile.title, success/error value
 */
export function logDestinationStatus(
  serviceName: string,
  status: LogType,
  title: string,
  message: string
): void {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logEntry = `[${serviceName}]: ${status} [${timestamp}]: ${title}, ${message}\n`;
  
  fs.appendFileSync(successErrorLogFile, logEntry);
}

/**
 * Log detailed error information to the error log
 * Format:
 * [service-name] [yyyy-mm-dd hh:mm]: ERROR
 * Title: songfile.title
 * Error Type: [authentication|validation|network|server|unknown]
 * Error Message: [original error message]
 * Request Details: [relevant request data that caused the error]
 * Attempt: [1|2|3] of 3
 */
export function logDetailedError(
  serviceName: string,
  title: string,
  errorType: ErrorType,
  errorMessage: string,
  requestDetails: any,
  attempt: number
): void {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const logEntry = `
[${serviceName}] [${timestamp}]: ERROR
Title: ${title}
Error Type: ${errorType}
Error Message: ${errorMessage}
Request Details: ${JSON.stringify(requestDetails, null, 2)}
Attempt: ${attempt} of 3
---------------------------------------------
`;
  
  fs.appendFileSync(detailedErrorLogFile, logEntry);
}

/**
 * Log parser events with appropriate level filtering
 * 
 * This function logs parser events based on the configured log level:
 * - ERROR: Always logged
 * - WARNING: Logged if level is warning, info, or debug
 * - INFO: Logged if level is info or debug
 * - DEBUG: Logged only if level is debug
 * 
 * @param parserName Name of the parser (e.g., 'M3U8Parser')
 * @param eventType Type of event (ERROR, WARNING, INFO, DEBUG)
 * @param message Log message
 * @param details Optional details object for additional context
 */
export function logParserEvent(
  parserName: string,
  eventType: ParserLogType,
  message: string,
  details?: any
): void {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  // Only log to console based on level and environment setting
  const logLevel = process.env.LOG_LEVEL || 'info';
  
  // Determine if we should log based on level
  const shouldLog = (
    (eventType === ParserLogType.ERROR) ||
    (eventType === ParserLogType.WARNING && logLevel !== 'error') ||
    (eventType === ParserLogType.INFO && ['info', 'debug'].includes(logLevel)) ||
    (eventType === ParserLogType.DEBUG && logLevel === 'debug')
  );
  
  if (shouldLog) {
    switch (eventType) {
      case ParserLogType.ERROR:
        console.error(`[${parserName}] [${timestamp}]: ${message}`);
        break;
      case ParserLogType.WARNING:
        console.warn(`[${parserName}] [${timestamp}]: ${message}`);
        break;
      case ParserLogType.INFO:
      case ParserLogType.DEBUG:
        console.log(`[${parserName}] [${timestamp}]: ${message}`);
        break;
    }
  }
  
  // Optionally log to file as well
  if (process.env.LOG_TO_FILE === 'true') {
    const logEntry = `[${parserName}] [${eventType}] [${timestamp}]: ${message}${details ? '\nDetails: ' + JSON.stringify(details, null, 2) : ''}\n`;
    fs.appendFileSync(parserLogFile, logEntry);
  }
}

/**
 * Log upload progress for destination services
 * 
 * This function logs the progress of uploads to destination services.
 * It's designed to provide visibility into the upload process without
 * cluttering the logs with too much detail.
 * 
 * @param serviceName Name of the destination service
 * @param title Title of the upload
 * @param stage Current stage of the upload process
 * @param progress Progress as a decimal (0.0 to 1.0)
 * @param message Additional context message
 */
export function logUploadProgress(
  serviceName: string,
  title: string,
  stage: UploadStage,
  progress: number,
  message: string
): void {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logEntry = `[${serviceName}]: progress [${timestamp}]: ${title}, ${stage}, ${Math.round(progress * 100)}%, ${message}\n`;
  
  // Log to console if not in production or if explicitly enabled
  if (process.env.NODE_ENV !== 'production' || process.env.LOG_UPLOAD_PROGRESS === 'true') {
    console.log(logEntry.trim());
  }
  
  // Always log to file
  fs.appendFileSync(successErrorLogFile, logEntry);
}
