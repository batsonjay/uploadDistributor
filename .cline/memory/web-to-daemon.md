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

## Implementation Steps

### Phase 1: Basic Structure
1. Create Next.js page structure:
   - /login
   - /upload
   - /upload/validate
   - /upload/progress
2. Implement basic routing and layouts
3. Create placeholder components

### Phase 2: Authentication
1. Port AuthService for web client use:
   - Extract shared types and interfaces
   - Create browser-compatible auth utilities
   - Handle password encoding in browser
2. Implement auth flow in web client:
   - Login form with validation
   - Token storage and management
   - Protected route handling
3. Add auth state management:
   - User context provider
   - Role-based access control
   - Session persistence

### Phase 3: Upload Form
1. Create form components:
   - File upload fields with drag-drop
   - Metadata fields with validation
   - Directory/playlist selection based on DJ
2. Add basic file type validation:
   - MP3 extension check
   - JPG format verification
   - Basic size checks
3. Implement form state management:
   - React form handling
   - File state tracking
   - Validation state
4. Add "Next" button functionality

### Phase 4: Client-side Processing
1. Port songlist-parser for browser use:
   - Create browser-compatible version
   - Handle file reading in browser
   - Maintain parsing logic
2. Implement client-side file processing:
   - File reading and validation
   - Format detection
   - Parse songlist data
3. Create results display component:
   - Table view of parsed songs
   - Error highlighting
   - Validation status
4. Add title/artist swap functionality:
   - Swap button implementation
   - Preview updates
   - State management
5. Implement artwork validation:
   - Image format check
   - Dimension validation if possible
   - Error feedback

### Phase 5: Upload Implementation
1. Create upload progress UI:
   - Progress bars for each file
   - Status messages
   - Cancel button
2. Implement file upload logic:
   - Chunked file uploads
   - Progress tracking
   - Concurrent uploads
3. Add progress tracking:
   - Individual file progress
   - Overall status
   - Time remaining
4. Implement cancel functionality:
   - Cancel individual uploads
   - Clean up partial uploads
5. Add error handling:
   - Retry logic
   - Error messages
   - Recovery options

### Phase 6: Daemon Integration
1. Implement required API endpoints:
   - Auth endpoint with existing service
   - Upload endpoint with multipart
   - Status endpoint
2. Add file storage logic:
   - Use existing FileManager
   - Handle concurrent uploads
   - Maintain directory structure
3. Create status logging:
   - Upload progress
   - File receipt confirmation
   - Error logging
4. Test end-to-end flow:
   - Auth flow
   - File upload
   - Status updates

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
