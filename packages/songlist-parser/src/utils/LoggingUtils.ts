/**
 * Simplified Logging Utilities for Songlist Parser
 * 
 * This module provides a simplified version of the logging utilities
 * for use within the songlist-parser package. It mirrors the interface
 * of the daemon's LoggingUtils but with a simpler implementation.
 */

// Parser log types
export enum ParserLogType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  DEBUG = 'debug'
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
  // Use process.env.LOG_LEVEL if available, otherwise default to 'info'
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
}
