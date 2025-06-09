# AzuraCast Upload Flow

This document outlines the flow of data and processes involved in uploading files to AzuraCast from the Upload Distributor daemon, from the point where "Starting upload to AzuraCast..." is logged to "AzuraCast upload completed successfully".

If necessary, read /README.md and the architecture files in /docs for further background on the entire project.

* **Related, but un-described work**
  * The web-ui is designed to provide upload progress indication of the .mp3 file. Most will be large. Because the development so far has used small .mp3 files in order to get initial code in place, an upload of a large file has not been tested. This matters because the mock will need to be prepared to receive a large file. In addition, code is needed as part of this work to provide a way for the web-ui to display upload progress.

## Large File Upload Investigation

### Problem Identification

During testing of the `/send` endpoint with large files, it was discovered that while the endpoint works correctly for small files, it fails when attempting to upload large MP3 files (100MB+). The investigation revealed that the issue is not with the `/send` endpoint logic itself, but rather with server-side upload limits that prevent large file transfers.

**Root Cause Analysis:**
- The `/send` endpoint successfully processes small files using the current base64 JSON approach
- Large file uploads fail due to server configuration limits, not application logic
- The current implementation uses a working file transfer mechanism that simply hits server boundaries
- The user experience issue (inability to validate track listings before upload) was already solved by the two-step `/send` process

**Key Finding:** The `/send` endpoint functionality is correct - but, The AzuraCast installation ONLY supports base64 JSON uploads via the API. The limitation then becomes server configuration related, making this a deployment/infrastructure issue rather than an application architecture problem.

AzuraCast itself uses a Flow.js chunked upload system, but this is __exclusively for the web interface__, not the API. The API endpoint `/station/{station_id}/files` expects:

1. __JSON content-type__ (not multipart)
2. __Base64-encoded file content__ (not binary)
3. __Single request__ (not chunked)

### Why It Works vs. Fails

- ✅ __Small files (< ~100MB)__: Base64 encoding fits within server request limits
- ❌ __Large files (117MB → 163MB base64)__: Exceeds server's max request body size

### Large File Upload Investigation Results

During investigation of large file upload solutions, the AzuraCast Flow.js chunked upload endpoint was evaluated as an alternative to the current base64 JSON approach.

**Flow.js Upload Endpoint Analysis:**
- **Endpoint**: `/station/{station_id}/files/flow` (not in OpenAPI spec - internal only)
- **Authentication**: Likely requires web session cookies, not API key
- **Return Value**: Probably doesn't return the structured file ID we need for metadata setting
- **Complexity**: Would require reverse-engineering their exact Flow.js implementation

**Challenges Identified:**
- The GitHub search for Flow.js implementation details requires authentication
- The endpoint is not documented in the public API specification
- Authentication mechanism differs from our API key-based approach
- Uncertain metadata setting capability after chunked upload
- Would require complex chunked upload implementation

### Server Configuration Approach (RECOMMENDED)

**For handling large file uploads, the recommended approach is server configuration changes rather than implementing Flow.js chunked uploads.**

**Server Configuration Solutions:**

**For Nginx** (most common):
```nginx
# In your nginx.conf or site config
client_max_body_size 500M;  # Adjust as needed
```

**For Apache**:
```apache
# In .htaccess or apache config
LimitRequestBody 524288000  # 500MB in bytes
```

**For PHP** (also needed):
```ini
# In php.ini
upload_max_filesize = 500M
post_max_size = 500M
max_execution_time = 300
memory_limit = 512M
```

***Recommendation Rationale:***

1. ✅ **Keeps working code**: Our base64 JSON approach already works perfectly for small files
2. ✅ **Simple one-time fix**: Just increase server limits
3. ✅ **Maintains API compatibility**: Still get proper file IDs for metadata setting
4. ✅ **No authentication issues**: Uses existing API key system
5. ✅ **Future-proof**: Works for any file size you set

## API definition**
  * The full API documentation for each API call is available at https://radio.balearic-fm.com/docs/api/, including both the syntax for sending as well as all responses, and the schema.

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
    * `album`: Constructs from CET date + ' Broadcast' **QUESTION: What is this used for on AzuraCast?**
    * `genre`: Uses `songlist.broadcast_data.genre` (which comes from metadata.genre) or defaults to 'Radio Show'. (TODO: The genre should get added to the description in the podcast episode.)

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

* **Three-Step Upload Process**
  AzuraCast service performs upload to AzuraCast station in 4 steps: 
  * **Step 1: Upload the .mp3 media file**
    * Calls `api.uploadFile(audioFilePath, metadata)`
    * Sends the file to `https://radio.balearic-fm.com/api/station/2/files`
    * If successful, returns `{success: true, id: fileId, path: destinationPath}`
    * If unsuccessful, logs error and throws exception to trigger retry

  * **Step 2: Send metadata and playlist association**
    * Only proceeds if Step 1 was successful
    * Calls `POST /station/{station_id}/file/{id}` with metadata and playlist IDs
    * Associates the metadata with the uploaded file using the fileId returned in Step 1
    * Includes playlist ID for DJ-specific playlist
    * Podcast playlist association is deferred until AzuraCast supports explicit podcast sync
    * If unsuccessful, logs error and throws exception to trigger retry

* **Success Handling**
  * If all three steps succeed, the status manager logs success
  * Detailed logging includes:
    * Original filename: The basename of the source file
    * File ID: The ID assigned by AzuraCast (e.g., "mock-azuracast-1747920290524")
    * Destination path: Full path on AzuraCast server (e.g., "/var/azuracast/stations/2/files/mock-azuracast-1747920290524.mp3")
    * Destination filename: The filename portion of the destination path
    * Title, artist, and genre from the metadata
  * The system logs "AzuraCast upload completed successfully"

## Implementation Plan

Implementation will be done using a hybrid plan, initially making GET calls directly to the AzuraCast server but using a Mock for any POST calls. After the PUTs seems appropriate, the service will switch to calling the AzuraCast server instead of the mocks. Note that the AzuraCast server has 2 "stations". Station 1 is the live/production server; station 2 is availale for development / test use. The implementation should declare the station number as a constant, and set it to 2 until ready for use on the live station, when the constant is changed to 1.

### Mock Implementation

 The mock implementation allows for safe local development and testing of the media upload and playlist scheduling flow using the AzuraCast API. This mock should replicate the behavior and data structure of the real API to allow the front-end React app to simulate the complete flow without calling the live service.

---

#### Required End-to-End Flow

The full flow that must be mocked includes:

1. **Receive Media File Upload**
2. **Receive Metadata Update**
3. **Set Playback Time on Playlist**
4. **Add Media to Podcast Feed** (deferred)

Each of these steps requires interaction with a specific AzuraCast API endpoint and returns JSON responses the mock must reproduce accurately.

---

#### Step-by-Step Responsibilities

##### 1. Receive a Media File

**API Path**:  
`POST /station/{station_id}/files`

**Request**:  
Multipart form-data with headers:
- `Authorization: Bearer <API_TOKEN>`
- `Content-Type: multipart/form-data`

**Form Data Fields**:
```json
{
  "path": "uploads/{djName}/filename.mp3",
  "file": "<binary contents>"
}
```

**Mock Behavior**:
- Validate the required fields exist.
- Return JSON resembling the real API response, including:
  - `path`
  - `name`
  - `length`
  - `media_id` (a unique mock ID used in later steps, which must be retained transiently)

---

##### 2. Receive Metadata Update

**API Path**:  
`POST /station/{station_id}/file/{id}`

**Request JSON**
```json
{
  "artist": "{{songlist.broadcast_data.DJ}}",
  "title": "{{songlist.broadcast_data.setTitle}}",
  "album": "{{songlist.broadcast_data.setTitle}}",
  "genre": "{{songlist.broadcast_data.genre}}",
  "playlists": [
    "{{DJ-playlist-id}}" // Presumes AzuraCast Service has obtained the playlist ID for the specific DJ
    // Podcast playlist association deferred until AzuraCast supports explicit sync
  ]
}
```
**Mock Behavior**:
- Mock will have been pre-provisioned with valid playlist ID; test if properly received
- Validate format of all items and print JSON to console as-if being received. 
- On success return status 200 with confirmation JSON.
```json
{
  "success": true
}
```
- We should mock a failure to receive valid info. AI agent should examine API reference page noted at the top of this and create a proper return for failure.

---

##### 3. Set Playback Time for Playlist

**API Path**:  
`PUT /station/{station_id}/playlist/{playlist_id}`

**Request JSON**:
```json
{
  "schedule_items": [
    {
      "start_date": "Uses `songlist.broadcast_data.broadcast_date` (YYYY-MM-DD format)",
      "start_time": "Convert `songlist.broadcast_data.broadcast_time` to minutes from midnight (integer)",
      "end_time": "Add 60 minutes to start_time (integer minutes from midnight)", 
      "loop_once": true
    }
  ]
}
```

**Mock Behavior**:
- Accept the same playlist_id obtained in prior mock call (this will be the end of use of that id, which can at the point be dropped)
- Accept a JSON payload with a valid `schedule_items` array.
- Return status 200 with confirmation JSON.
```json
{
  "success": true
}
```

---

##### 4. Add Media to Podcast Feed

The podcast episode feed on AzuraCast is automatically generated from the the contents of the playlist called "podcast". However, AzuraCast only synchronizes the podcast with this playlist either periodically, or on an explicit action to update the podcast. It's possible that no API endpoint exists for this as of the writing of this document.

 **Ommitted for now**. This action requires an API endpoint that apparently does not exist in AzuraCast. Developer of this app is working with developer of AzruaCast to expose an appropriate endpoint. Until it appears, this section cannot be implemented. 

---

### Deliverables for Developer

- A single mock API service supporting necesary endpoints for POSTs.
- mainline code that utilizes "live" API endpoints on dev / test AzuraCast server got GETs.
- Coverage for error handling (e.g., 400 on missing fields, 404 on invalid IDs).

---

## Implementation Plan: Phased Integration with Live AzuraCast Server

This plan outlines a two-step approach to transition from mock-based development to partial and then full integration with the live AzuraCast server.

### ✅ Step 1: Hybrid Mode — Real Lookups, Mock Uploads (COMPLETED)

**Goal**: Enable partial integration with the live AzuraCast server to validate connectivity and metadata correctness, while retaining mock behavior for uploads and playlist modifications.

#### Tasks:
- [x] Refactor `AzuraCastService` to accept a real `AzuraCastApi` instance (not just the mock).
- [x] Implement commenting approach to toggle between mock and real API behavior.
- [x] Implement real API calls for:
  - `GET /station/{station_id}/playlists`
  - `GET /station/{station_id}/podcasts` (deferred until AzuraCast podcast API is complete)
- [x] Use mock for:
  - `POST /station/{station_id}/files`
  - `PUT /station/{station_id}/playlist/{playlist_id}`
- [x] Validate that metadata transformation (title, artist, album, genre) matches AzuraCast expectations.

#### Outcome:
- We can test real playlist lookups and confirm DJ-to-playlist mappings.
- We can verify metadata correctness without risking real uploads.

---

### ✅ Step 2: Full Integration — Real Uploads and Scheduling (COMPLETED)

**Goal**: Replace all mock behavior with real API calls to complete the end-to-end upload and scheduling flow.

#### Tasks:
- [x] Replace mock `uploadFile`, `setMetadata`, `addToPlaylist` and `schedulePlaylist` with real implementations.
- [x] Ensure file path includes DJ subdirectory (e.g., `uploads/{djName}/filename.mp3`).
- [x] Use real `media_id` returned from upload in all subsequent steps.
- [x] Implement error handling and retry logic for each real API call.
- [x] Confirm that scheduled playback work as expected on the live server.

#### Outcome:
- The daemon can fully automate the upload and playlist scheduling using the live AzuraCast server.

#### Implementation Approach

The implementation used a commenting approach to toggle between mock and real API calls:

1. **Comment/Uncomment Sections**: In `AzuraCastService.ts`, each step of the upload process has clearly marked sections for "APPROACH 1: Use Mock API" and "APPROACH 2: Use Real API"
2. **Incremental Testing**: Each API endpoint was tested individually by commenting out the mock approach and uncommenting the real API approach
3. **Error Handling**: Enhanced error logging was added to each real API call to facilitate debugging
4. **Server Maintenance**: Testing was done incrementally with server housekeeping between each step

This approach proved more reliable than environment variable configuration flags and allows for easy switching between mock and real implementations during development.

---

### 🧪 One-Time Development Setup Notes

During development, especially when using a separate dev/test AzuraCast server, some setup steps may need to be performed once per environment:

- **Podcast ID Lookup**: **Note**: Deferred for above-stated reasons. The station has a single podcast. Its ID must be determined once via `GET /station/{station_id}/podcasts` and stored for reuse. But, it should be used as a runtime variable, since when switching from the dev/test AzuraCast server the podcast ID is likely to be different, and so the code needs to use the appropriate podcast iD for the {station_id} in use.

To support this, I want a utility function (e.g., `runAzuraCastSetupTasks()`) that can be toggled on/off via a config flag. This function can:
- Fetch and log the podcast ID
- Be run manually during environment setup or testing

## Key Data Structures

* **Source File Path**
  * Format: `/packages/daemon/received-files/{fileId}/{normalizedBase}.mp3`
  * Example: `/packages/daemon/received-files/74ce0458-b51b-4783-b721-fdbb23f012fc/2025-05-19_catalyst_m.mp3`
  * The `normalizedBase` is constructed from broadcast date, DJ name, and title

* **Destination File Path**
  * Format: `/var/azuracast/stations/{stationId}/files/{dj_name}/{normalizedBase}.mp3` **NOTE: I updated this manually to include DJ-name in path, so there is no guarantee that there is no error in the psuedobvcode syntax**
  * Example: `/var/azuracast/stations/2/files/catalyst/2025-05-18_catalyst_m.mp3`

* **AzuraCast Metadata Object**
  ```
  {
    title: "m",                    // From songlist.broadcast_data.setTitle
    artist: "catalyst",            // From songlist.broadcast_data.DJ
    album: "2025-05-22 Broadcast", // Constructed from CET date
    genre: "Electronic"            // From songlist.broadcast_data.genre (which comes from `metadata.genre`) or default "Radio Show"
  }
  ```

## URL Construction

* **Base URL**: `https://radio.balearic-fm.com` (hardcoded in AzuraCastApi constructor)
* **API Endpoint**: `/api/station/{stationId}/files`
* **Station ID**: `2` (hardcoded in AzuraCastApiMock constructor)
* **Full URL**: `https://radio.balearic-fm.com/api/station/2/files`
* **Destination File Path**: /{dj_name}/{normalizedBase}.mp3

## Key Observations

1. **URL Construction**:
   - The base URL is hardcoded in the AzuraCastApi constructor as `https://radio.balearic-fm.com`
   - The station ID is hardcoded in the AzuraCastApiMock constructor as `2` (for dev/test)
   - The full upload URL becomes: `https://radio.balearic-fm.com/api/station/2/files/{dj_name}/{normalizedBase}.mp3`

2. **Metadata Transformation**:
   - The genre from the form (`metadata.genre`) is stored in `songlist.broadcast_data.genre` and then passed to AzuraCast
   - If no genre is provided in the form, it defaults to an empty string
   - The AzuraCastService uses this value or defaults to 'Radio Show' if empty

3. **File ID Usage**:
   - The `fileId` in console logs is a UUID for the entire upload session
   - It's used to create a directory for all files related to an upload
   - The AzuraCast file ID is generated by the AzuraCast API when the file is uploaded
   - In the mock implementation, it's generated as `mock-azuracast-{timestamp}`

4. **Upload Process**:
   - The upload is wrapped in a retry mechanism with up to 2 retries
   - The process has three steps: upload file, set metadata, add to playlist
   - Each step must succeed before proceeding to the next
   - A future (deferred) step will be to add it to the station podcast. This is deferred until support for this is added to the AzuraCast API.

## Potential Issues

1. **Hardcoded Values**:
   - The base URL and station ID are hardcoded, making it difficult to switch between environments
   - These should be moved to environment variables for easier configuration

2. **Genre Handling**:
   - The genre from the form is now properly used in the songlist
   - The flow is clear: metadata.genre → songlist.broadcast_data.genre → AzuraCastMetadata.genre
   - (A previously incorrect implementation may have been resolved in the current implementation; needs confirmed)
