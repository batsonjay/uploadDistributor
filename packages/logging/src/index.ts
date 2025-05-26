/**
 * Logging utility for the Upload Distributor project
 * 
 * This module provides a consistent logging interface across the application.
 * It supports categorized logging with unique message IDs for easier debugging.
 */

// Log categories configuration - only these categories will be shown in the console
export const LogConfig = {
  // Daemon categories
  'D:AUTH  ': true,  // Authentication-related logs
  'D:AUTHDB': true, // Authentication-related logs - deeper debugging
  'D:FILE  ': true,  // File operations
  'D:FILEDB': false, // File operations - deeper debugging
  'D:API   ': true,  // External API interactions
  'D:APIDB ': false,  // External API interactions - deeper debugging
  'D:ROUTE ': true,  // HTTP route handling
  'D:RTEDB ': false, // HTTP route handling - deeper debugging
  'D:PARSER': true,  // Songlist parsing operations
  'D:PARSDB': false, // Songlist parsing operations - deeper debugging
  'D:WORKER': true,  // Worker thread operations
  'D:WORKDB': false, // Worker thread operations - deeper debugging
  'D:SYSTEM': true,  // System-level operations
  'D:STATUS': true,  // Status updates and tracking
  'D:STATDB': false, // Status updates and tracking - deeper debugging
  'D:EMAIL ': true,  // Email authentication logs
  'D:EMAILD': false, // Email authentication logs - deeper debugging
  
  // Client categories
  'C:AUTH  ': true,  // Authentication flows
  'C:FORM  ': true,  // Form submissions and validations
  'C:API   ': true,  // API requests to the daemon
  'C:NAV   ': true,  // Navigation and routing
  'C:STATE ': true,  // State management
  
  // Shared categories
  'SECURITY': true,  // Security-related events (always enabled)
  'ERROR   ': true,  // Error logging (always enabled)
  'DEBUG   ': true   // Detailed debugging information
};

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

/**
 * Log a message with a specific category and ID
 * 
 * @param category - The log category (e.g., 'D:FILE', 'C:AUTH')
 * @param id - The unique message ID (e.g., 'FI:001', 'AU:023')
 * @param message - The log message
 * @param args - Additional arguments to log
 */
export const log = (category: keyof typeof LogConfig, id: string, message: string, ...args: any[]) => {
  if (LogConfig[category]) {
    originalConsoleLog(`[${category}][${id}] - ${message}`, ...args);
  }
};

/**
 * Log an error with a specific category and ID
 * 
 * @param category - The log category (e.g., 'D:FILE', 'C:AUTH')
 * @param id - The unique message ID (e.g., 'FI:001', 'AU:023')
 * @param message - The error message
 * @param args - Additional arguments to log
 */
export const logError = (category: keyof typeof LogConfig, id: string, message: string, ...args: any[]) => {
  // Always log errors regardless of category configuration
  originalConsoleError(`[${category}][${id}] - ${message}`, ...args);
};

// No enums needed anymore - using string literals directly in the code

// Export default for convenience
export default {
  log,
  logError,
  LogConfig
};
