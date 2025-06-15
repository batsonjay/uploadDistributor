# AzuraCast Upload Flow

This document outlines the flow of data and processes involved in uploading files to AzuraCast from the Upload Distributor daemon, from the point where "Starting upload to AzuraCast..." is logged to "AzuraCast upload completed successfully".

If necessary, read /README.md and the architecture files in /docs for further background on the entire project.

* **Related, but un-described work**
  * The web-ui is designed to provide upload progress indication of the .mp3 file. Most will be large. The web-ui includes a progress bar that should be supported by the SFTP upload implementation for better user experience during large file transfers.

## Large File Upload Solution

### Problem Resolution

During testing with large files (100MB+), it was discovered that the AzuraCast API's base64 JSON upload approach fails due to server-side limits. The API endpoint `/station/{station_id}/files` expects:

1. **JSON content-type** (not multipart)
2. **Base64-encoded file content** (not binary)
3. **Single request** (not chunked)

This creates fundamental limitations:
- ✅ **Small files (< ~100MB)**: Base64 encoding fits within server request limits
- ❌ **Large files (117MB → 163MB base64)**: Exceeds server's max request body size, memory limits, and timeout constraints

### SFTP Upload Solution

The solution implemented uses SFTP (SSH File Transfer Protocol) for the file upload portion while maintaining API calls for metadata and scheduling:

**Benefits of SFTP Approach:**
- **Direct Binary Upload**: No base64 encoding overhead
- **Streaming Transfer**: No memory constraints for large files
- **Reliable Protocol**: SFTP is designed for large file transfers
- **Server Compatibility**: Works with existing AzuraCast file structure
- **Progress Tracking**: SFTP supports upload progress callbacks

## API Definition

The full API documentation for each API call is available at https://radio.balearic-fm.com/docs/api/, including both the syntax for sending as well as all responses, and the schema.

## Upload Process Flow

* **Preparation: Songlist Creation**
  * The songlist is created earlier in the process, in the `file-processor.ts` file
  * The process starts by parsing the uploaded songlist file using `parseSonglist(songlistFile)`
  * If parsing is successful, a `SonglistData` object is created with:
    ```
    songlist = {
      broadcast_data: {
        broadcast_date: metadata.broadcastDate || new Date().toISOString().split('T')[0],
        broadcast_time: metadata.broadcastTime || '00:00:00',
        DJ: metadata.djName || 'Unknown DJ',
        setTitle: metadata.title || 'Untitled Set',
        genre: metadata.genre || '',
        description: metadata.description || '',
        artwork: metadata.artworkFilename || 'artwork.jpg'
      },
      track_list: parseResult.songs, // Array of songs from the parsed file
      version: '1.0'
    }
    ```
  * If parsing fails or no songs are found, a minimal songlist is created with default values
  * The songlist is stored using `storeSonglist(fileId, songlist)` for future reference
  * The user role is added to the songlist: `songlist.user_role = userRole`

* **Initialization**
  * The upload process begins in `file-processor.ts` when it reaches the AzuraCast upload section
  * The system logs "Starting upload to AzuraCast..."
  * The status is updated to "processing" with the message "Uploading to AzuraCast"

* **Metadata Creation**
  * `azuraCastService.createMetadataFromSonglist(songlist)` is called to create AzuraCast-specific metadata
  * This transforms the songlist data into the format expected by AzuraCast:
    * `title`: Uses `songlist.broadcast_data.setTitle` or defaults to 'Untitled Set'
    * `artist`: Uses `songlist.broadcast_data.DJ` or defaults to 'Unknown DJ'
    * `album`: Constructs from CET date + ' Broadcast'
    * `genre`: Uses `songlist.broadcast_data.genre` (which comes from metadata.genre) or defaults to 'Radio Show'

* **Upload File Method**
  * Main daemon flow calls `azuraCastService.uploadFile(audioFile, azuraCastMetadata)` with:
    * `audioFile`: Path to the MP3 file in the received-files directory
    * `azuraCastMetadata`: The metadata object created in the previous step

* **Retry Mechanism**
  * The upload process is wrapped in a retry utility with these settings:
    * Maximum retries: 2
    * Initial delay: 1000ms
    * Backoff factor: 2 (doubles the delay for each retry)
  * Each retry logs information about the attempt number and delay

* **Four-Step Hybrid Upload Process**
  AzuraCast service performs upload to AzuraCast station using a hybrid SFTP/API approach:
  
  * **Step 1: SFTP Upload of .mp3 media file**
    * Uses SFTP to upload the file directly to `/var/azuracast/stations/{stationId}/files/{djName}/filename.mp3`
    * Bypasses API file size limitations and base64 encoding overhead
    * Supports progress tracking for large file uploads
    * DJ directory must already exist (returns error if not found)
    * If unsuccessful, logs error and throws exception to trigger retry

  * **Step 2: API File Discovery**
    * Uses `GET /station/{station_id}/files` to locate the uploaded file
    * Searches for the file by path to obtain the AzuraCast-assigned file ID
    * This ID is required for subsequent metadata and playlist operations
    * If file not found, logs error and throws exception to trigger retry

  * **Step 3: API Metadata and Playlist Association**
    * Calls `PUT /station/{station_id}/file/{id}` with metadata and playlist IDs
    * Associates the metadata with the uploaded file using the file ID from Step 2
    * Includes playlist ID for DJ-specific playlist
    * Podcast playlist association is deferred until AzuraCast supports explicit podcast sync
    * If unsuccessful, logs error and throws exception to trigger retry

  * **Step 4: API Playlist Scheduling**
    * Calls `PUT /station/{station_id}/playlist/{playlist_id}` with schedule items
    * Sets the broadcast time and duration for the playlist
    * Uses broadcast date and time from songlist to schedule playback
    * If unsuccessful, logs error and throws exception to trigger retry

* **Success Handling**
  * If all four steps succeed, the status manager logs success
  * Detailed logging includes:
    * Original filename: The basename of the source file
    * File ID: The ID assigned by AzuraCast after file discovery
    * Destination path: Full SFTP path on AzuraCast server
    * Destination filename: The filename portion of the destination path
    * Title, artist, and genre from the metadata
  * The system logs "AzuraCast upload completed successfully"

## Implementation Plan: Phased Integration with Live AzuraCast Server

This plan outlines the three-step evolution from mock-based development to full SFTP integration.

### ✅ Step 1: Hybrid Mode — Real Lookups, Mock Uploads (COMPLETED)

**Goal**: Enable partial integration with the live AzuraCast server to validate connectivity and metadata correctness, while retaining mock behavior for uploads and playlist modifications.

#### Tasks:
- [x] Refactor `AzuraCastService` to accept a real `AzuraCastApi` instance (not just the mock)
- [x] Implement commenting approach to toggle between mock and real API behavior
- [x] Implement real API calls for:
  - `GET /station/{station_id}/playlists`
  - `GET /station/{station_id}/podcasts` (deferred until AzuraCast podcast API is complete)
- [x] Use mock for:
  - `POST /station/{station_id}/files`
  - `PUT /station/{station_id}/playlist/{playlist_id}`
- [x] Validate that metadata transformation (title, artist, album, genre) matches AzuraCast expectations

#### Outcome:
- Confirmed real playlist lookups and DJ-to-playlist mappings work correctly
- Verified metadata correctness without risking real uploads

---

### ✅ Step 2: Full API Integration — Real Uploads and Scheduling (COMPLETED)

**Goal**: Replace all mock behavior with real API calls to complete the end-to-end upload and scheduling flow.

#### Tasks:
- [x] Replace mock `uploadFile`, `setMetadata`, `addToPlaylist` and `schedulePlaylist` with real implementations
- [x] Ensure file path includes DJ subdirectory (e.g., `uploads/{djName}/filename.mp3`)
- [x] Use real `media_id` returned from upload in all subsequent steps
- [x] Implement error handling and retry logic for each real API call
- [x] Confirm that scheduled playback works as expected on the live server

#### Outcome:
- The daemon could fully automate upload and playlist scheduling using the live AzuraCast server
- Identified large file upload limitations with base64 API approach

#### Implementation Approach:
The implementation used a commenting approach to toggle between mock and real API calls, allowing for incremental testing of each endpoint individually.

---

### 🚧 Step 3: SFTP Integration — Hybrid SFTP/API Upload (IN PROGRESS)

**Goal**: Replace the problematic API file upload with SFTP while maintaining API calls for metadata and scheduling operations.

#### Tasks:
- [ ] Add SFTP client dependency (`ssh2-sftp-client`)
- [ ] Create `AzuraCastSftpApi` class for SFTP operations
- [ ] Add SFTP configuration constants (host, credentials, paths)
- [ ] Implement SFTP upload method with progress tracking
- [ ] Add API file discovery method to find uploaded files
- [ ] Modify `AzuraCastService` to use hybrid SFTP/API approach
- [ ] Update logging to include SFTP operations
- [ ] Test with large files (100MB+)

#### Configuration:
- **SFTP Host**: `radio.balearic-fm.com` (reusing existing domain constant)
- **SFTP Port**: `2022`
- **SFTP Username**: `daemon1`
- **SFTP Password**: `Bale.8012`
- **SFTP Base Path**: `/var/azuracast/stations/2/files` (for dev/test station)
- **File Path Structure**: `{djName}/{filename.mp3}`

#### Error Handling:
- SFTP connection failures logged to daemon status file
- No fallback to API upload (API upload will be removed)
- DJ directory must exist (error returned if not found)
- Retry mechanism applies to entire SFTP/API sequence

#### Outcome (Expected):
- Large file uploads (100MB+) will work reliably
- Upload progress tracking will be available for web-ui
- All existing metadata and scheduling functionality preserved

---

### 🧪 One-Time Development Setup Notes

During development, especially when using a separate dev/test AzuraCast server, some setup steps may need to be performed once per environment:

- **DJ Directory Verification**: Ensure all DJ directories exist in `/var/azuracast/stations/{stationId}/files/` before attempting uploads
- **SFTP Access Testing**: Verify SFTP credentials and connectivity during daemon startup
- **Podcast ID Lookup**: **Note**: Deferred for above-stated reasons. The station has a single podcast. Its ID must be determined once via `GET /station/{station_id}/podcasts` and stored for reuse

To support this, a utility function (e.g., `runAzuraCastSetupTasks()`) can be toggled on/off via a config flag to:
- Test SFTP connectivity
- Fetch and log the podcast ID
- Verify DJ directory structure

## Key Data Structures

* **Source File Path**
  * Format: `/packages/daemon/received-files/{fileId}/{normalizedBase}.mp3`
  * Example: `/packages/daemon/received-files/74ce0458-b51b-4783-b721-fdbb23f012fc/2025-05-19_catalyst_m.mp3`
  * The `normalizedBase` is constructed from broadcast date, DJ name, and title

* **SFTP Destination File Path**
  * Format: `/var/azuracast/stations/{stationId}/files/{dj_name}/{normalizedBase}.mp3`
  * Example: `/var/azuracast/stations/2/files/catalyst/2025-05-18_catalyst_m.mp3`
  * DJ directory must exist prior to upload

* **AzuraCast Metadata Object**
  ```
  {
    title: "m",                    // From songlist.broadcast_data.setTitle
    artist: "catalyst",            // From songlist.broadcast_data.DJ
    album: "2025-05-22 Broadcast", // Constructed from CET date
    genre: "Electronic"            // From songlist.broadcast_data.genre or default "Radio Show"
  }
  ```

## Configuration Constants

* **Base URL**: `https://radio.balearic-fm.com` (defined in AzuraCastApi constructor)
* **Station ID**: `2` (for dev/test), `1` (for production)
* **SFTP Host**: `radio.balearic-fm.com` (reuses base URL domain)
* **SFTP Port**: `2022`
* **SFTP Username**: `daemon`
* **SFTP Password**: `Bale.8012`
* **SFTP Base Path**: `` (empty - user is chrooted to files directory)

## Key Observations

1. **Hybrid Architecture**:
   - SFTP handles the large file upload efficiently
   - API handles metadata, playlists, and scheduling (smaller payloads)
   - Best of both worlds: reliable file transfer + rich metadata management

2. **File Path Consistency**:
   - SFTP upload path matches AzuraCast's expected file structure
   - API file discovery can locate SFTP-uploaded files
   - DJ subdirectories maintain organization

3. **Error Handling**:
   - No fallback to API upload (API upload limitations are fundamental)
   - Clear error messages for missing DJ directories
   - Comprehensive logging for troubleshooting SFTP issues

4. **Future Enhancements**:
   - Upload progress tracking for web-ui integration
   - Podcast playlist association when AzuraCast API supports it
   - Potential for parallel uploads if multiple files are queued

## Potential Issues

1. **DJ Directory Dependencies**:
   - Upload will fail if DJ directory doesn't exist on AzuraCast server
   - Manual directory creation may be required for new DJs

2. **SFTP Connectivity**:
   - Network issues or credential changes will break uploads
   - No fallback mechanism (by design)

3. **File Discovery Timing**:
   - Brief delay may be needed between SFTP upload and API file discovery
   - AzuraCast may need time to detect the new file
