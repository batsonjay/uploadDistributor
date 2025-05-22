# Web Client to Daemon Implementation Plan

## Overview
This document outlines the implementation plan for the web client interface and its communication with the daemon. The focus is on creating a user-friendly upload process with client-side validation and progress tracking.

## Components

### 1. Authentication Page
- Use Next.js App Router for routing and page structure
- Implement AzuraCast authentication:
  - Reuse existing AuthService implementation from daemon
  - Support both mock and real AzuraCast API modes
  - Handle password encoding/decoding
  - Verify DJ directories exist in AzuraCast
  - Store auth token securely
  - Handle role-based access (Admin vs DJ)
- Redirect to upload form on successful auth

### 2. Upload Form Page
#### Initial Form View
- File input fields:
  - MP3 file upload
  - Songlist file upload (supporting multiple formats)
  - Artwork file upload
- Metadata fields:
  - Title
  - DJ Name (pre-filled from auth)
  - Genre
  - AzuraCast folder/playlist selection (based on DJ's verified directory)
- "Next" button to proceed to validation

#### Client-side Processing
- Implement browser-based file validation:
  - MP3 file extension check
  - Artwork validation:
    - JPG format verification
    - File dimensions check (1440px square) if possible
    - Fallback to basic image format validation if not
- Integrate songlist-parser package for browser:
  - Create browser-compatible version of parser
  - Process songlist file client-side
  - Display parsed results in table format
- Add title/artist swap functionality:
  - Button to swap all entries
  - Preview of changes
- Show validation status for each component

#### Upload Progress View
- Progress indicators for large files:
  - MP3 upload progress bar
  - Artwork upload progress bar
- Status messages for each stage
- Cancel upload option
- Error handling and retry capability

## Daemon Integration

### 1. API Endpoints
- POST /auth
  - Accept AzuraCast credentials
  - Use existing AuthService for validation
  - Return session token
- POST /upload
  - Multipart form data handling
  - Accept:
    - MP3 file
    - Artwork file
    - Songlist JSON
    - Metadata object
  - Store in DJ's verified directory
- GET /status
  - Return current upload/processing status

### 2. File Processing
- Store files in appropriate directory structure (using existing FileManager)
- Log receipt of files (temporary implementation)
- Return success/failure status
- Prepare for future integration with upload destinations

## Implementation Status

### Completed Work

#### Phase 1: Basic Structure ✅
1. Created Next.js page structure:
   - /login
   - /upload
   - /upload/validate
   - /upload/progress
2. Implemented basic routing and layouts
3. Created placeholder components

#### Phase 2: Authentication ✅
1. Ported AuthService for web client use:
   - Extracted shared types and interfaces
   - Created browser-compatible auth utilities
   - Implemented password encoding in browser
2. Implemented auth flow in web client:
   - Login form with validation
   - Token storage and management
   - Protected route handling
3. Added auth state management:
   - User context provider
   - Role-based access control
   - Session persistence

#### Phase 3: Upload Form ✅
1. Created form components:
   - File upload fields with drag-drop
   - Metadata fields with validation
   - Directory/playlist selection based on DJ
2. Added basic file type validation:
   - MP3 extension check
   - JPG format verification
   - Basic size checks
3. Implemented genre list validation
4. Implemented form state management:
   - React form handling
   - File state tracking
   - Validation state
5. Added "Next" button functionality

#### Phase 6: Daemon Integration (Partial) ✅
1. Implemented required API endpoints:
   - Auth endpoint with existing service
   - Upload endpoint with multipart
   - Status endpoint
   - Added parse-songlist endpoint for songlist processing
2. Added file storage logic:
   - Using existing FileManager
   - Handling concurrent uploads
   - Maintaining directory structure
3. Created status logging:
   - Upload progress
   - File receipt confirmation
   - Error logging

### Recent Updates

#### Songlist Parser Integration ✅
1. Integrated songlist-parser package into daemon:
   - Created SonglistParserService wrapper
   - Added dedicated parse-songlist API endpoint
   - Implemented worker thread for background processing
2. Updated file handling:
   - Modified file-processor to use normalized filenames from metadata
   - Simplified archive directory structure for better organization
   - Removed hardcoded paths in favor of metadata-driven file resolution
   - Improved file cleanup to properly remove temporary directories
3. Enhanced error handling and logging:
   - Added more detailed error messages
   - Improved status tracking
   - Rationalized console logging

### In Progress

#### Phase 4: Client-side Validation 🔄
1. Implementing client-side file validation:
   - File extension verification
   - Basic size and format checks
   - Metadata validation

#### Phase 5: Upload Implementation 🔄
1. Creating upload progress UI:
   - Progress bars for each file
   - Status messages
   - Cancel button
2. Implementing file upload logic:
   - Chunked file uploads
   - Progress tracking
   - Concurrent uploads

### Next Steps

1. Enhance the main upload flow (/upload) to use the new parse-songlist endpoint:
   - Update the upload process to leverage the daemon's integrated songlist parser
   - Ensure proper handling of parsed results in the validation flow
   - Maintain title/artist order confirmation functionality

2. Mark the test-parse page as obsolete:
   - This was only an interim step to bootstrap upload functionality
   - The main upload flow in /upload now handles the complete process

3. Complete end-to-end testing:
   - Auth flow
   - File upload with the integrated songlist parser
   - Status updates and error handling
   - Archive file verification

## Success Criteria
- User can authenticate via AzuraCast
- Files can be selected and validated client-side
- Songlist can be parsed and previewed in browser
- Title/artist order can be swapped if needed
- Files successfully upload to daemon with progress indication
- Daemon correctly stores files and logs receipt
- DJ directory verification works correctly
- Role-based access control is enforced

## Future Enhancements
- Real-time validation feedback
- Drag-and-drop file upload
- Upload queue for multiple mixes
- Detailed error reporting
- Resume interrupted uploads
- Image cropping/resizing for artwork
- Batch title/artist operations
