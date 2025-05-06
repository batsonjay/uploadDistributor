/**
 * Logging Utilities
 * 
 * This module provides utilities for logging destination status and errors.
 * It implements a two-tier logging system:
 * 1. A status log that shows both success and failure with one line per destination
 * 2. A detailed error log that provides more information about errors
 */

import * as fs from 'fs';
import * as path from 'path';

// Define log file paths
const logsDir = process.env.LOGS_DIR || path.join(__dirname, '../../logs');
const successErrorLogFile = path.join(logsDir, 'destination-status.log');
const detailedErrorLogFile = path.join(logsDir, 'destination-errors.log');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log types
export enum LogType {
  SUCCESS = 'success',
  ERROR = 'error'
}

// Error types
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  NETWORK = 'network',
  SERVER = 'server',
  UNKNOWN = 'unknown'
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
