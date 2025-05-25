# Unified Logging Implementation Plan

This document outlines the plan for implementing a unified logging approach across the Upload Distributor project, focusing on migrating to the new `@uploadDistributor/logging` package and standardizing logging practices throughout the codebase.

## Goals

1. Standardize logging across all components using the new logging system
2. Improve debugging capabilities with categorized and identifiable log messages
3. Reduce console output verbosity while maintaining useful information
4. Implement consistent error logging with appropriate context
5. Prepare for future enhancements like structured logging and log aggregation

## Current Issues

Based on analysis of the current codebase and log output:

- Inconsistent log formats (some with timestamps, some without)
- Excessive logging of routine operations
- Lack of categorization in many log messages
- Mix of logging styles making it difficult to trace execution flow
- Direct use of console.log/error in many places
- Two parallel logging systems (LoggingUtils.ts and @uploadDistributor/logging)

## Implementation Strategy for Daemon

We'll organize the work into logical buckets for a systematic approach:

### Bucket 1: Core Logging Infrastructure

1. **Enhance Logging Package (Already Done)**
   - ✅ Created `@uploadDistributor/logging` package with categorized logging
   - ✅ Implemented log and logError functions with category filtering
   - ✅ Defined daemon, client, and shared categories

2. **Deprecate LoggingUtils.ts**
   - Instead of adapting it, we'll gradually replace all its usages with direct calls to the new logging system
   - Eventually remove LoggingUtils.ts once all references are updated

### Bucket 2: Server and Route Handler Logging

1. **Update index.ts**
   - Replace direct console.log calls with categorized logging
   - Use 'D:SYSTEM' for server startup/shutdown
   - Use 'D:ROUTE' for request/response logging

2. **Update Route Handlers**
   - Update auth.ts, send.ts, receive.ts, etc.
   - Replace logParserEvent calls with new logging system
   - Use consistent message IDs for each route

### Bucket 3: Middleware and Service Logging

1. **Update Middleware**
   - Update roleVerification.js and other middleware
   - Use 'D:AUTH' category for authentication logs

2. **Update Services**
   - Update AuthService, AzuraCastService, etc.
   - Use 'D:API' for external API calls
   - Use 'D:FILE' for file operations

### Bucket 4: Processor and Worker Logging

1. **Update File Processor**
   - Replace process.stdout/stderr with categorized logging
   - Use 'D:WORKER' for worker thread operations
   - Use 'D:FILE' for file operations

2. **Update Parser Services**
   - Update SonglistParserService
   - Use 'D:PARSER' for parsing operations

### Bucket 5: Testing and Validation

1. **Create Logging Test Cases**
   - Verify all log categories work as expected
   - Test error handling paths
   - Validate log format consistency

2. **Run Integration Tests**
   - Verify logging during normal operation
   - Test logging during error conditions
   - Ensure no excessive logging

## Implementation Strategy for Web UI

After completing the daemon logging updates, we'll extend the standardized logging to the web UI:

### Bucket 6: Web UI Core Logging

1. **Client-Side Logging Setup**
   - Configure client categories in the logging package
   - Implement browser-appropriate logging mechanisms
   - Add development vs. production logging modes

2. **Error Boundary Logging**
   - Add structured error logging for React error boundaries
   - Implement consistent error reporting

### Bucket 7: Component and Page Logging

1. **Auth Flow Logging**
   - Add logging to authentication flows
   - Track login/logout events and errors

2. **Form Submission Logging**
   - Log form validation and submission events
   - Track user interactions with appropriate privacy considerations

3. **API Interaction Logging**
   - Log requests to the daemon
   - Track response times and errors

### Bucket 8: State Management Logging

1. **Context API Logging**
   - Add logging to context providers and consumers
   - Track state changes with appropriate detail level

2. **Form State Logging**
   - Log form state transitions
   - Track validation errors

### Bucket 9: Web UI Testing and Validation

1. **Client-Side Log Testing**
   - Verify client-side logging works as expected
   - Test error scenarios

2. **End-to-End Testing**
   - Validate logging during user flows
   - Ensure appropriate logging in production builds

## Implementation Approach

1. **Start with Core Infrastructure** (Bucket 1)
   - This provides the foundation for all other changes

2. **Tackle Server and Middleware** (Bucket 2)
   - These affect all requests and provide the execution context

3. **Update Route Handlers** (Bucket 3)
   - Focus on one route at a time, starting with most critical paths

4. **Refactor Services and Processors** (Bucket 4)
   - These contain the business logic and most complex operations

5. **Test and Validate Daemon Changes** (Bucket 5)
   - Ensure all daemon changes work as expected

6. **Implement Web UI Logging** (Buckets 6-9)
   - After daemon logging is stable

## Expected Outcomes

1. **Improved Debugging**: Categorized logs make it easier to trace execution flow
2. **Consistent Format**: All logs follow the same format with categories and IDs
3. **Appropriate Verbosity**: Different log levels for different environments
4. **Better Error Context**: Errors include relevant context for faster debugging
5. **Future-Ready**: Foundation for structured logging and log aggregation

## Previous Logging System (Historical Reference)

The previous logging approach focused primarily on parser-specific logging and destination upload tracking. It included:

- `LoggingUtils.ts` with functions like `logParserEvent`, `logDestinationStatus`, and `logDetailedError`
- Environment variables for controlling log levels (LOG_LEVEL, LOG_TO_FILE)
- Timestamp-based logging with different formats for different components
- File-based logging for specific operations (parser events, destination status)
- Enum-based log types (ParserLogType, LogType, ErrorType)

This approach had limitations in consistency and scalability, which the new logging system addresses through categorization, standardized message IDs, and a unified interface across all application components.
