# File Sending Flow

This document outlines the proposed architecture for the file sending and processing flow in the Upload Distributor application.

## Overview

The file sending flow is designed to provide a smooth user experience while handling large media files efficiently. The flow is divided into distinct phases:

1. **Initial Send & Songlist Validation**: Only the songlist file is sent to the daemon initially
2. **Songlist Review & Confirmation**: DJ reviews and can modify parsed songs
3. **Full File Sending Process**: All files are sent to the daemon with progress indication
4. **Processing & Destination Upload**: Files are processed and uploaded to destinations
5. **Completion & Feedback**: DJ is notified of success or failure

## Detailed Flow

### Phase 1: Initial Send & Songlist Validation

1. DJ visits `/send` page and fills in metadata (title, DJ, date, time, genre, description)
2. DJ selects three files:
   - Audio file (MP3)
   - Songlist file (TXT, RTF, DOCX, NML, M3U8)
   - Artwork file (JPG)
3. DJ clicks "Next"
4. **Frontend sends only the songlist file** to the daemon via a new endpoint: `/parse-songlist/validate`
   - This endpoint accepts only the songlist file and metadata
   - The MP3 and artwork files remain in the browser, not yet sent
5. Daemon parses the songlist and returns the parsed songs
6. Frontend redirects to `/send/validate` with the parsed songs and metadata

### Phase 2: Songlist Review & Confirmation

1. DJ reviews the parsed songs on `/send/validate` page
2. DJ can swap title/artist fields if needed
3. DJ clicks "Send" to proceed with the full file sending process

### Phase 3: Full File Sending Process

1. Frontend initiates the full file sending process to a new endpoint: `/send/process`
   - This endpoint uses busboy to handle large file transfers
   - It accepts all three files (MP3, artwork, songlist) and metadata
2. Frontend displays a progress bar showing the sending status
   - This is especially important for MP3 files (60-130MB)
   - Progress updates are sent from the server to the client
3. Files are stored on the daemon with a unique fileId
4. Metadata is stored in a metadata.json file

### Phase 4: Processing & Destination Upload

1. After successful file reception, the daemon automatically starts a worker thread
   - No separate confirmation request is needed
   - The worker thread is started by the `/send/process` endpoint
2. The worker thread runs the code in `file-processor-worker.ts`
3. This calls `processFile(fileId)` in `file-processor.ts`
4. The `processFile` function:
   - Reads the files from the directory
   - Uploads them to destinations (AzuraCast, Mixcloud, SoundCloud)
   - Updates status information

### Phase 5: Completion & Feedback

1. **Success Case**:
   - Server sends a success response
   - Frontend displays a success message for 3 seconds
   - Frontend automatically redirects back to `/send` page
   - The form is reset for a new file send

2. **Error Case**:
   - Server sends an error response with details
   - Frontend displays an error message
   - Frontend provides a "Return to Send" button
   - When clicked, DJ is redirected to `/send` with form pre-filled with the failed send data
   - DJ can make adjustments and try again

## API Endpoints

### New/Modified Endpoints

1. **`/parse-songlist/validate`** (New)
   - **Purpose**: Parse and validate only the songlist file
   - **Method**: POST
   - **Inputs**: Songlist file, metadata
   - **Outputs**: Parsed songs array
   - **Description**: This endpoint only handles the songlist file, not the MP3 or artwork

2. **`/send/process`** (New)
   - **Purpose**: Handle the full file sending process
   - **Method**: POST
   - **Inputs**: MP3 file, artwork file, songlist file, metadata
   - **Outputs**: Sending status, fileId
   - **Description**: Uses busboy to handle large file transfers, stores files, and automatically starts processing

3. **`/send/status/:fileId`** (New)
   - **Purpose**: Get the status of a file send
   - **Method**: GET
   - **Inputs**: fileId
   - **Outputs**: Current status, progress percentage, destination upload statuses
   - **Description**: Provides real-time status updates for the frontend

### Deprecated Endpoints

1. **`/parse-songlist/:fileId/confirm`**
   - This endpoint will be deprecated as its functionality is merged into `/send/process`

## Frontend Changes

1. **Send Page (`/send`)**
   - Displayed after successful user authentication
   - Modified to only send the songlist file initially
   - Retains MP3 and artwork files in memory until validation is complete

2. **Validate Page (`/send/validate`)**
   - Modified to initiate the full file sending process
   - Displays sending progress bar
   - Handles success and error cases

3. **New File Sending Progress Component**
   - Displays sending progress percentage
   - Shows which file is currently being sent
   - Provides cancel option

4. **New Success/Error Pages or Components**
   - Success: Displays confirmation, auto-redirects after 3 seconds
   - Error: Displays error details, provides "Return to Send" button

## Benefits of the New Architecture

1. **Better DJ Experience**
   - DJs validate the songlist before committing to the full file send
   - Progress indication for large file transfers
   - Clear feedback on success or failure

2. **Separation of Concerns**
   - Songlist parsing is separate from file processing
   - Each endpoint has a clear, single responsibility

3. **Efficiency**
   - Large files are only sent after validation
   - No unnecessary file transfers

4. **Error Handling**
   - Better error recovery with pre-filled forms
   - Clearer error messages and status updates

## Implementation Considerations

1. **File Storage**
   - Temporary storage for validated songlists
   - Permanent storage for fully processed files

2. **Progress Tracking**
   - WebSocket or Server-Sent Events for real-time progress updates
   - Fallback to polling for browsers without WebSocket support

3. **Security**
   - Ensure proper authentication for all endpoints
   - Validate file types and sizes
   - Implement rate limiting for file sending endpoints

4. **Performance**
   - Optimize busboy configuration for large file handling
   - Consider chunked file sending for very large files
   - Implement timeout handling for long-running operations

## Implementation Plan

To minimize disruption and ensure the system remains functional throughout the transition, the implementation will be broken down into the following steps:

### Step 1: Daemon-Side Changes

1. Create new daemon endpoints while keeping existing ones functional:
   - Create `/send/process` endpoint (similar to current `/upload` endpoint)
   - Create `/send/status/:fileId` endpoint
   - Create `/parse-songlist/validate` endpoint
   - Keep existing endpoints functional for backward compatibility

2. Update the file-processor to work with both old and new endpoints:
   - Ensure it can be triggered from both the new `/send/process` endpoint and the existing `/parse-songlist/:fileId/confirm` endpoint

3. Test after Step 1:
   - Verify new endpoints work correctly with curl or Postman
   - Ensure existing functionality still works with the current web UI

### Step 2: Web UI Changes

1. Create new web UI routes:
   - Create `/send` page (copy of current `/upload` page)
   - Create `/send/validate` page (copy of current `/upload/validate` page)
   - Update authentication flow to redirect to `/send` instead of `/upload`

2. Update the new pages to use the new daemon endpoints:
   - Update `/send` page to send songlist to `/parse-songlist/validate`
   - Update `/send/validate` page to send files to `/send/process`
   - Add progress bar for file sending
   - Implement success/error handling with appropriate redirects

3. Test after Step 2:
   - Verify complete flow works with new routes and endpoints
   - Test authentication flow redirects to `/send`
   - Test large file uploads with progress indication
   - Test error handling and recovery

After both steps are completed and verified, the old routes and endpoints can be deprecated in a future update once all clients have been updated to use the new flow.
