# Implementation Plan

This document outlines the proposed implementation steps for the Upload Distributor project, including development phases, testing strategies, and deployment considerations.

## Phase 1: Project Setup and Infrastructure

### 1.1 Monorepo Configuration
- Initialize Turborepo structure
- Configure shared packages for common code
- Set up ESLint, Prettier, and TypeScript configurations
- Establish CI/CD pipeline with GitHub Actions

### 1.2 Development Environment
- Document local development setup requirements
- Create development scripts for all components
- Configure local environment variables

### 1.3 Testing Framework
- Set up Jest for unit testing
- Configure testing utilities for each component
- Establish code coverage requirements

## Phase 2: Core Components Development

### 2.1 Daemon Development

#### 2.1.1 Standardized Songlist Format
- Create a standardized JSON schema for songlists with the following structure:
  ```json
  {
    "broadcast_data": {
      "broadcast_date": "2025-05-04",
      "broadcast_time": "20:00:00",
      "DJ": "DJ Example",
      "setTitle": "Saturday Night Mix",
      "duration": "02:00:00",
      "genre": "Deep House",
      "tags": ["electronic", "house", "deep", "melodic"],
      "artwork": "/path/to/cover-image.jpg",
      "description": "A deep and melodic journey through the sounds of Deep House."
    },
    "track_list": [
      {
        "title": "Example Track One",
        "artist": "Artist A"
      },
      {
        "title": "Example Track Two",
        "artist": "Artist B"
      }
    ],
    "platform_specific": {
      "mixcloud": {
        "tags": ["Deep House", "Electronic"],
        "publish_date": "2025-05-04T20:00:00Z"
      },
      "soundcloud": {
        "sharing": "public",
        "license": "cc-by-nc-sa"
      }
    },
    "user_role": "DJ", // or "Admin"
    "destinations": ["azuracast", "mixcloud", "soundcloud"], // Only used by Admin role
    "version": "1.0"
  }
  ```
- All timestamps in the JSON will be stored in UTC format
- Create sample songlist JSON files for development and testing

#### 2.1.2 Persistent Storage for Songlists
- Implement file-based storage for songlists
- Store songlists in folders organized by DJ name
- Use filename format: `yyyy-mm-dd-title` where spaces in title are replaced by hyphens
- Create stub for songlist normalization (to be fully implemented later)
- Implement functions to store and retrieve songlists

#### 2.1.3 Destination API Mocks
- Create mock implementations for all three destination APIs:
  - AzuraCast
  - Mixcloud
  - SoundCloud
- Implement validation of received data against expected formats
- Add logging to show what information was received
- Include verification that information is complete and correctly formatted
- Create stubs for authentication (to be implemented later)

#### 2.1.4 Distribution Flow
- Enhance upload processor to distribute to all three destinations
- Implement the flow to send songlist data to all destinations
- Implement timezone conversion from UTC to appropriate formats for each destination
- Create two separate response flows:
  - For DJ users: Return success as soon as upload to daemon is complete
  - For Admin users: Return detailed status for each destination
- Implement logging system with two log files:
  - Success/error log with one-line entries per destination
  - Detailed error-only log with comprehensive information
- Create a unified interface for all destination APIs

#### 2.1.5 Testing Enhancements
- Update test script to use the standardized songlist format
- Test the entire flow from upload to distribution
- Verify results from each destination

### 2.2 Web Client Development (Deferred)
- Create Next.js application structure
- Implement role-based UI (DJ vs Admin interfaces)
- Build upload form and metadata entry
- Implement timezone handling (collect in CET, convert to UTC for storage)
- Develop appropriate status tracking UI based on user role:
  - DJ: Simple upload confirmation
  - Admin: Detailed destination status
- Implement error handling appropriate to user role
- Authentication flow with role retrieval (deferred to Phase 3)

### 2.3 macOS Client Development (Deferred)
- Set up Electron with React
- Implement role-based UI (DJ vs Admin interfaces)
- Create FileZilla-like UI with role-appropriate controls
- Build file selection and upload flow
- Implement timezone handling (collect in CET, convert to UTC for storage)
- Develop appropriate status tracking based on user role:
  - DJ: Simple upload confirmation
  - Admin: Detailed destination status with retry options
- Secure credential storage with role information (deferred to Phase 3)

## Phase 3: Destination API Integration and Authentication

### 3.1 Authentication Implementation (Completed)
- ✅ Implement AzuraCast authentication flow with role retrieval (DJ vs Admin)
- ✅ Create secure credential storage for clients including user role
- ✅ Implement role-based permission system in daemon API endpoints
- ✅ Integrate with real AzuraCast API for authentication
- Build OAuth2 authentication for Mixcloud (Pending)
- Build OAuth2 authentication for SoundCloud (Pending)

### 3.2 AzuraCast Integration
- Replace mock with actual AzuraCast API integration
- Implement file upload functionality
- Create metadata association
- Build playlist integration

### 3.3 Mixcloud Integration
- Replace mock with actual Mixcloud API integration
- Implement file upload functionality
- Create metadata and tracklist formatting
- Handle rate limiting and error cases

### 3.4 SoundCloud Integration
- Replace mock with actual SoundCloud API integration
- Implement file upload functionality
- Create metadata formatting
- Handle rate limiting and error cases

## Phase 4: Testing Strategy

### 4.1 Testing Harness for Destination APIs

#### AzuraCast Testing
- Set up staging server for AzuraCast
- Create test accounts and API tokens
- Implement integration tests against staging environment
- Develop cleanup routines for test data

#### Mixcloud and SoundCloud Testing Harness
- Create mock server to simulate API responses
- Implement request validation for correct formatting
- Develop response simulation for success and error cases
- Build recording mechanism to capture API calls for verification

#### Testing Harness Implementation
```javascript
// Base class for all destination API mocks
class DestinationApiMock {
  constructor(destination) {
    this.destination = destination;
    this.requests = [];
  }

  // Record API calls for verification
  recordRequest(endpoint, data) {
    this.requests.push({ endpoint, data, timestamp: new Date().toISOString() });
    console.log(`[${this.destination}] Request to ${endpoint}:`, JSON.stringify(data, null, 2));
  }

  // Validate required fields
  validateRequiredFields(data, requiredFields) {
    const missing = requiredFields.filter(field => !data[field]);
    if (missing.length > 0) {
      console.error(`[${this.destination}] Missing required fields: ${missing.join(', ')}`);
      return false;
    }
    console.log(`[${this.destination}] All required fields present`);
    return true;
  }

  // Stub for authentication (to be implemented later)
  authenticate() {
    console.log(`[${this.destination}] Authentication stub called`);
    return Promise.resolve({ success: true, token: 'mock-token' });
  }
}

// Example usage in tests
const azuraCastMock = new DestinationApiMock('azuracast');
// Validate upload data
const isValid = azuraCastMock.validateRequiredFields(uploadData, ['title', 'artist']);
// Record the request for verification
azuraCastMock.recordRequest('upload', uploadData);
```

#### Songlist Storage Implementation
```javascript
// Function to store songlist persistently
function storeSonglist(uploadId, songlist) {
  const djDir = path.join(songslistsDir, songlist.broadcast_data.DJ);
  
  // Create DJ directory if it doesn't exist
  if (!fs.existsSync(djDir)) {
    fs.mkdirSync(djDir, { recursive: true });
  }
  
  // Create a filename based on broadcast date and title
  // Format: yyyy-mm-dd-title (spaces in title replaced by hyphens)
  const filename = `${songlist.broadcast_data.broadcast_date}-${
    songlist.broadcast_data.setTitle.replace(/\s+/g, '-')
  }.json`;
  
  const filePath = path.join(djDir, filename);
  
  // Write the songlist to file
  fs.writeFileSync(filePath, JSON.stringify(songlist, null, 2));
  
  return filePath;
}
```

### 4.2 Unit Testing
- Test individual components in isolation
- Mock external dependencies
- Achieve high code coverage

### 4.3 Integration Testing
- Test interaction between components
- Use mock servers for external APIs
- Verify end-to-end workflows

### 4.4 End-to-End Testing
- Test complete user flows
- Use Cypress for web client testing
- Use Spectron for macOS client testing

## Phase 5: Integration and Refinement

### 5.1 Component Integration
- Connect daemon with web and macOS clients
- Verify authentication flows
- Test upload and status tracking end-to-end

### 5.2 Error Handling and Recovery
- Implement comprehensive error handling with role-appropriate responses:
  - DJ users: Simple success/failure for daemon upload
  - Admin users: Detailed status for all destinations
- Develop retry mechanisms for Admin users
- Implement the two-tier logging system:
  - Success/error log with concise entries
  - Detailed error-only log
- Create user-friendly error messages appropriate to user role

### 5.3 Performance Optimization
- Optimize file handling for large uploads
- Improve concurrent upload processing
- Enhance UI responsiveness

## Phase 6: Deployment and Documentation

### 6.1 Deployment
- Create Docker containers for daemon
- Document deployment procedures
- Set up monitoring and logging

### 6.2 User Documentation
- Create user guides for web and macOS clients
- Document configuration options
- Provide troubleshooting information

### 6.3 Developer Documentation
- Update API documentation
- Document code architecture
- Create contribution guidelines

## Implementation Timeline (Revised)

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Project Setup | 1 week | None |
| 2. Core Components (Revised) | 4 weeks | Phase 1 |
| 3. Authentication & API Integration | 3 weeks | Phase 2 |
| 4. Testing | 2 weeks (parallel with Phase 3) | Phase 2 |
| 5. Integration | 2 weeks | Phases 3 & 4 |
| 6. Deployment | 1 week | Phase 5 |

Total estimated timeline: 10-12 weeks

## Current Progress (as of May 6, 2025)

### Completed Tasks

#### Phase 1: Project Setup and Infrastructure
- ✅ Initialized Turborepo structure
- ✅ Configured shared packages for common code
- ✅ Set up ESLint, Prettier, and TypeScript configurations

#### Phase 2: Core Components Development
- ✅ Implemented Express server with API endpoints
- ✅ Created file upload handling with Busboy
- ✅ Developed process forking for concurrent uploads
- ✅ Fixed TypeScript configuration issues:
  - Updated package path references to relative paths in tsconfig.json files
  - Resolved "File '@uploadDistributor/typescript-config/daemon.json' not found" error
- ✅ Improved development mode functionality:
  - Enhanced process spawning for TypeScript files
  - Added better logging and debugging information
  - Fixed path resolution issues
- ✅ Enhanced status endpoint:
  - Added detailed metadata and file information
  - Improved error handling and type safety
- ✅ Created standardized songlist format and sample files:
  - Implemented JSON schema for songlists
  - Created sample songlist.json for testing
- ✅ Implemented persistent storage for songlists:
  - Created file-based storage organized by DJ name
  - Implemented functions to store and retrieve songlists
  - Added support for filename format: yyyy-mm-dd-title
- ✅ Created destination API mocks for all three platforms:
  - Implemented base DestinationApiMock class with common functionality
  - Created AzuraCastApiMock with upload, metadata, and playlist methods
  - Created MixcloudApiMock with upload and track list support
  - Created SoundCloudApiMock with upload and metadata methods
  - Added validation for required fields in all mocks
- ✅ Enhanced upload processor to distribute to all destinations:
  - Updated to use the standardized songlist format
  - Implemented parallel uploads to all three platforms
  - Added detailed status reporting for each destination
  - Improved error handling and logging
- ✅ Created test script to verify the entire flow:
  - Implemented test-upload-processor.ts for end-to-end testing
  - Added support for creating test uploads with mock data
  - Included verification of results from all destinations
- ✅ Implemented Timezone Conversion:
  - Created TimezoneUtils.ts with functions for converting between UTC and CET/CEST
  - Updated upload-processor.ts to use these conversions for metadata
- ✅ Implemented Two-Tier Logging System:
  - Created LoggingUtils.ts with functions for logging destination status and errors
  - Added support for both concise success/error logs and detailed error logs
- ✅ Refactored upload-processor.ts (file exceeded 500-line guideline):
  - Created services directory with destination-specific upload services:
    - StatusManager.ts for centralized status updates and logging
    - AzuraCastService.ts for AzuraCast-specific upload logic
    - MixcloudService.ts for Mixcloud-specific upload logic
    - SoundCloudService.ts for SoundCloud-specific upload logic
  - Made the main upload-processor.ts file more concise by delegating to service classes
  - Improved error handling and recovery logic for each destination
- ✅ Implemented two-step process for SoundCloud uploads:
  - Updated SoundCloudApiMock to properly implement the two-step upload process API
  - Enhanced SoundCloudService to use the two-step process:
    1. First uploads the file
    2. Then updates the metadata in a separate step
  - Added privacy setting fallback for quota/permission issues
  - Implemented comprehensive error handling and recovery logic

#### Phase 3: Authentication Implementation (Completed)
For detailed information about the authentication implementation, see [Authentication Implementation](./auth-implementation.md).
- ✅ Created AuthService with role-based authentication:
  - Implemented singleton pattern for global access
  - Added support for DJ and Admin roles
  - Created mock users for testing
  - Added token validation and user retrieval
- ✅ Implemented auth routes:
  - Added login endpoint with role retrieval
  - Created token validation endpoint
  - Added user profile endpoint
- ✅ Updated AzuraCastApiMock to use AuthService:
  - Added authentication methods that use the central AuthService
  - Implemented token validation
  - Added user profile retrieval
- ✅ Implemented Password Obfuscation with XOR:
  - Created PasswordUtils.ts with functions for encoding/decoding passwords
  - Updated AuthService to use password obfuscation
  - Updated auth routes to handle encoded passwords
  - Updated AzuraCastApiMock to support encoded passwords
  - Created and ran test script to verify password obfuscation works correctly
- ✅ Implemented Role-Based Access Control:
  - Created roleVerification middleware with verifyRole, adminOnly, and anyAuthenticated functions
  - Protected upload and status routes with role verification
  - Added user information to request object for use in route handlers
  - Created comprehensive test script to verify role-based access control
- ✅ Implemented Directory Verification for DJs:
  - Added checkDjDirectoryExists method to AzuraCastApi class
  - Created test script to verify directory existence
  - Implemented path pattern detection for DJ directories
  - Added error handling for directory verification failures
  - Updated documentation to include directory verification step
  - Fixed role detection in mapAzuraCastRoleToUserRole to properly handle complex role objects
  - Updated test-directory-verification.ts to correctly test DJ directory verification

### Current Status
- The daemon is now functioning correctly in development mode
- File uploads are processed successfully and distributed to all platforms
- Songlist data is standardized, parsed, and stored persistently
- Status tracking is working with detailed information for all destinations
- Mock implementations for all destination APIs are in place
- Authentication service with role-based access is implemented
- Upload processor has been refactored into service-based architecture
- Two-tier logging system is implemented
- SoundCloud two-step upload process is working correctly
- Password obfuscation is implemented to avoid plaintext passwords
- Role-based access control is implemented with middleware for route protection
- Directory verification for DJs is implemented to ensure valid upload paths
- The project has a solid foundation for further development

### Next Steps
- Continue replacing mocks with actual API integrations:
  - Complete AzuraCast API integration for file uploads
  - Implement proper error handling for network issues
  - Integrate with Mixcloud and SoundCloud APIs
- Start work on Web Client Development with role-based UI

## Critical Path and Risk Mitigation (Revised)

### Critical Path
1. Daemon development with mock APIs
2. Songlist standardization and storage
3. Testing harness implementation
4. Authentication and real API integration
5. End-to-end integration

### Risk Mitigation

#### External API Changes
- Implement version checking for APIs
- Create adapter pattern for API interactions
- Monitor API status and changes

#### Large File Handling
- Test with progressively larger files
- Implement chunked uploads where supported
- Optimize memory usage during processing

#### Authentication Security
- Use secure storage for credentials including user role
- Implement token refresh mechanisms
- Create session timeout handling
- Ensure proper role-based access control

#### Role-Based Access Control
- Implement thorough validation of user roles
- Ensure Admin-only features are properly protected
- Test both DJ and Admin flows thoroughly
- Create clear error messages for unauthorized access attempts

## Conclusion

This implementation plan provides a structured approach to developing the Upload Distributor project. The testing harness for destination APIs is a critical component that will enable thorough testing without relying on live services for Mixcloud and SoundCloud, while allowing integration testing with a staging AzuraCast server.

By following this plan, the project can be developed in a modular, testable manner, with clear milestones and deliverables at each phase.
