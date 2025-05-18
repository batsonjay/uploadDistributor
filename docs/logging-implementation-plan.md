# Unified Logging Implementation Plan

This document outlines the plan for implementing a unified logging approach across the Upload Distributor project, with a focus on standardizing parser logging and preparing for destination upload development.

## Goals

1. Reduce console output verbosity while maintaining useful information
2. Standardize logging across all parsers
3. Prepare logging infrastructure for destination upload development
4. Implement environment-based logging control

## Implementation Strategy

### 1. Extend LoggingUtils Module

Extend the existing `LoggingUtils.ts` module to include parser-specific logging functions:

```typescript
// Add to LoggingUtils.ts
export enum ParserLogType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  DEBUG = 'debug'
}

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
    const parserLogFile = path.join(logsDir, 'parser-events.log');
    const logEntry = `[${parserName}] [${eventType}] [${timestamp}]: ${message}${details ? '\nDetails: ' + JSON.stringify(details, null, 2) : ''}\n`;
    fs.appendFileSync(parserLogFile, logEntry);
  }
}
```

### 2. Update Parser Implementations

Refactor all parsers to use the new logging utility:

#### M3U8Parser

```typescript
// Replace all console.log/error calls with:
import { logParserEvent, ParserLogType } from '../../daemon/src/utils/LoggingUtils.js';

// At start of parse method:
logParserEvent('M3U8Parser', ParserLogType.INFO, `Starting to parse file: ${path.basename(filePath)}`);

// For detailed parsing steps (currently verbose console.log):
logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Read file content, length: ${content.length}`);
logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Split into ${lines.length} lines`);

// For warnings:
logParserEvent('M3U8Parser', ParserLogType.WARNING, `No separator found, using full text as title`);

// For errors:
logParserEvent('M3U8Parser', ParserLogType.ERROR, `Error parsing M3U8 file: ${error}`);

// At end of parse method:
logParserEvent('M3U8Parser', ParserLogType.INFO, `Completed parsing, found ${songs.length} songs`);
```

#### Apply similar changes to other parsers:
- NMLParser
- TXTParser
- RTFLibParser
- TextractParser

### 3. Add Environment Configuration

Update the project's environment configuration to include logging settings:

```
# Add to .env.example
# Logging configuration
LOG_LEVEL=info      # error, warning, info, debug
LOG_TO_FILE=false   # true, false
```

Add documentation for these settings in the README or a dedicated logging document.

### 4. Prepare for Destination Upload Logging

Extend the existing destination logging functions to include more granular status updates:

```typescript
// Add to LoggingUtils.ts
export enum UploadStage {
  INIT = 'initialization',
  METADATA = 'metadata',
  UPLOAD = 'upload',
  FINALIZE = 'finalization'
}

export function logUploadProgress(
  serviceName: string,
  title: string,
  stage: UploadStage,
  progress: number,
  message: string
): void {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logEntry = `[${serviceName}]: progress [${timestamp}]: ${title}, ${stage}, ${Math.round(progress * 100)}%, ${message}\n`;
  
  // Log to console if not in production
  if (process.env.NODE_ENV !== 'production') {
    console.log(logEntry.trim());
  }
  
  // Always log to file
  fs.appendFileSync(successErrorLogFile, logEntry);
}
```

### 5. Implementation Phases

#### Phase 1: LoggingUtils Extension
1. Update LoggingUtils.ts with new parser logging functions
2. Add environment variable handling for log levels
3. Update .env.example with logging configuration options

#### Phase 2: Parser Refactoring
1. Refactor M3U8Parser to use the new logging utilities
2. Refactor NMLParser to use the new logging utilities
3. Refactor TXTParser to use the new logging utilities
4. Refactor RTFLibParser to use the new logging utilities
5. Refactor TextractParser to use the new logging utilities

#### Phase 3: Destination Upload Logging
1. Implement upload progress logging functions
2. Add logging points in destination service implementations
3. Test with mock uploads to verify logging behavior

## Expected Outcomes

1. **Reduced Console Noise**: By default, only INFO level and above will be logged to console
2. **Consistent Format**: All logs will follow the same format with timestamps and context
3. **Flexible Verbosity**: Developers can increase log detail during development without code changes
4. **File Logging Option**: Detailed logs can be captured to files for later analysis
5. **Prepared for Uploads**: Logging infrastructure ready for destination upload development

## Future Considerations

1. **Structured Logging**: Consider outputting logs in JSON format for better parsing
2. **Log Rotation**: Implement log rotation for production deployments
3. **Centralized Logging**: Prepare for integration with centralized logging systems
4. **Performance Metrics**: Add timing information to track parser and upload performance
