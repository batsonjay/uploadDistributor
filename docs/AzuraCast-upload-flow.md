# AzuraCast Upload Flow

This document outlines the flow of data and processes involved in uploading files to AzuraCast from the Upload Distributor daemon, from the point where "Starting upload to AzuraCast..." is logged to "AzuraCast upload completed successfully".

## Update as of 2025-05-27 06:55:00pm
This document was created early in the process of building the app. It is correct in the sense of *flow*, but there are some steps missing and some data that is incorrect. I'm going to collect some thoughts here, and then we'll work on "fixing" these things one at a time - updating this document as we create a plan to do it.

* **Edits mean this doc and code don't match** I made some edits to start to capture what needed to be done; but I don't think the things I added are in the flow, or the mocks. SO, warning: The stuff below "Upload Process Flow" in this doc isn't perfectly authoritative as of this time.

* **Upload file pathname not complete**
  * .mp3 media files are all uploaded to individual folders for each DJ. So, the name of the DJ for whom this set is being processed needs added to the end of the .../files path, which is not as it is currently constructed.

* **Need to check upload progress reporting / status**
  * The web-ui is designed to provide upload progress indication of the .mp3 file. Most will be large. Because the development so far has used small .mp3 files in order to get initial code in place, an upload of a large file has not been tested. This matters because the mock will need to be prepared to receive a large file.

* **Mock likely needs major work**
  * A review of the code in the mock makes me concerned that it inadequately models the AzuraCast APIs that are necessary to use. Here are the URLs to the API paths I'm certain we need to use. Note that the full API documentation for each API call is at https://radio.balearic-fm.com/docs/api/, including both the syntax for sending as well as all responses, and the schema. A new section is added after description of the 3 upload steps that outlines the mock. It actually provides slightly more information about the implied capabilities that the daemon needs to implement in order to complete the upload.

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
  * `azuraCastService.uploadFile(audioFile, azuraCastMetadata)` is called with:
    * `audioFile`: Path to the MP3 file in the received-files directory
    * `azuraCastMetadata`: The metadata object created in the previous step

* **Retry Mechanism**
  * The upload process is wrapped in a retry utility with these settings:
    * Maximum retries: 2
    * Initial delay: 1000ms
    * Backoff factor: 2 (doubles the delay for each retry)
  * Each retry logs information about the attempt number and delay

* **Three-Step Upload Process**
  * **Step 1: Upload the .mp3 media file**
    * Calls `api.uploadFile(audioFilePath, metadata)`
    * Sends the file to `https://radio.balearic-fm.com/api/station/2/files`
    **QUESTION: Where - if anywhere - are we setting the appropriate DJ subdirectory in the destination path? I don't think we are**
    * If successful, returns `{success: true, id: fileId, path: destinationPath}`
    * If unsuccessful, logs error and throws exception to trigger retry

  * **Step 2: Set metadata**
    * Only proceeds if Step 1 was successful
    * Calls `api.setMetadata(uploadResult.id, metadata)`
    * Associates the metadata with the uploaded file **QUESTION: How is this associated? By referencing the previously uploaded .mp3 file, or ...?**
    * If unsuccessful, logs error and throws exception to trigger retry

  * **Step 3: Add to playlist and the podcast**
    * Only proceeds if Step 2 was successful
    * Calls `api.addToPlaylist(uploadResult.id)`
    * Adds the file to playlist associated with the DJ
    * Adds the file to the podcast
    * Uses the metadata to set up the playlist with the date & time for play
    * Uses the metadata to set episode description text and the date and time on which the episode will be published (which is the same date / time as play is set in the prior step)
    * If unsuccessful, logs error and throws exception to trigger retry
    * NOTE: This Step was manually edited, not automatically generated. Some bullets in this describe things that should be done, but which are not implemented in the mock as of the time of editing.

* **Success Handling**
  * If all three steps succeed, the status manager logs success
  * Detailed logging includes:
    * Original filename: The basename of the source file
    * File ID: The ID assigned by AzuraCast (e.g., "mock-azuracast-1747920290524")
    * Destination path: Full path on AzuraCast server (e.g., "/var/azuracast/stations/2/files/mock-azuracast-1747920290524.mp3")
    * Destination filename: The filename portion of the destination path
    * Title, artist, and genre from the metadata
  * The system logs "AzuraCast upload completed successfully"

## Mock Implementation Plan: AzuraCast Upload + Playlist Association

This section outlines the responsibilities of a mock implementation for local development and testing of the media upload and playlist scheduling flow using the AzuraCast API. This mock should replicate the behavior and data structure of the real API to allow the front-end React app to simulate the complete flow without calling the live service.

---

### Required End-to-End Flow

The full flow that must be mocked includes:

1. **Media File Upload**
2. **Playlist Lookup (by DJ name)**
3. **Associate Media File with Playlist**
4. **Set Playback Time on Playlist**
5. **Add Media to Podcast Feed**

Each of these steps requires interaction with a specific AzuraCast API endpoint and returns JSON responses the mock must reproduce accurately.

---

### Step-by-Step Responsibilities

#### 1. Upload a Media File

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

#### 2. Lookup Playlist ID for a Given DJ

**API Path**:  
`GET /station/{station_id}/playlists`

**Mock Behavior**:
- Accept a DJ name (string). This is determined from the active DJ name in the songlist object, as created during the Send from the user to the daemon (via the web-ui).

- Filter a static list of mock playlists by matching DJ name against a metadata field like `playlist.name`.
- Return the correct `playlist_id`.

*Assumption*: There is exactly one playlist per DJ.

---

#### 3. Associate Uploaded Media with Playlist

**API Path**:  
`POST /station/{station_id}/playlist/{playlist_id}/media`

**Request JSON**:
```json
{
  "media_id": <media_id from upload>
}
```

**Mock Behavior**:
- Validate the `playlist_id` and `media_id` obtained from the two above mock calls.
- Simulate a successful media-to-playlist association.
- Return status 200 with confirmation JSON.

---

#### 4. Set Playback Time for Playlist

**API Path**:  
`PUT /station/{station_id}/playlist/{playlist_id}`

**Request JSON**:
```json
{
  "schedule_items": [
    {
      "start_time": "2025-06-01T14:00:00+00:00",
      "end_time": "2025-06-01T15:00:00+00:00",
      "days": [1],  // Monday
      "start_date": "2025-06-01"
    }
  ]
}
```

**Mock Behavior**:
- Accept the same playlist_id obtained in prior mock call (this will be the end of use of that id, which can at the point be dropped)
- Accept a JSON payload with a valid `schedule_items` array.
- Store this schedule data in memory or mock state for testing assertions.
- Return updated playlist metadata in response.

---

#### 5. Add Media to Podcast Feed

**API Path**:  
`POST /station/{station_id}/podcast/{podcast_id}/episode`

**Request JSON**:
```json
{
  "title": "DJ Show Title",
  "media_id": <media_id from upload>,
  "publish_at": "2025-06-01T15:00:00+00:00",
  "description": "Auto-generated from scheduled playlist",
  "episode_number": 123
}
```

**Mock Behavior**:
- Use the `media_id` from step 1. This is the end of that ID which can now be dropped.
- Use the **end time** from step 4 as the `publish_at` timestamp.
- Daemon provides fields `title` `description` from current songlist object; accepted by mock
- Return a success response including a mock `episode_id`.

*Note*: The station has a single podcast. The ID for this needs determined in a brief one-time API call to determine the ID.

---

### Deliverables for Developer

- A single mock API service supporting all five endpoints.
- Coverage for error handling (e.g., 400 on missing fields, 404 on invalid IDs).

---

## 🛠 Implementation Plan: Phased Integration with Live AzuraCast Server

This plan outlines a two-step approach to transition from mock-based development to partial and then full integration with the live AzuraCast server.

### ✅ Step 1: Hybrid Mode — Real Lookups, Mock Uploads

**Goal**: Enable partial integration with the live AzuraCast server to validate connectivity and metadata correctness, while retaining mock behavior for uploads and playlist modifications.

#### Tasks:
- [ ] Refactor `AzuraCastService` to accept a real `AzuraCastApi` instance (not just the mock).
- [ ] Introduce a configuration flag (e.g., `USE_AZURACAST_MOCKS`) to toggle mock behavior.
- [ ] Implement real API calls for:
  - `GET /station/{station_id}/playlists`
  - `GET /station/{station_id}/podcasts`
- [ ] Use mock for:
  - `POST /station/{station_id}/files`
  - `POST /station/{station_id}/playlist/{playlist_id}/media`
  - `PUT /station/{station_id}/playlist/{playlist_id}`
  - `POST /station/{station_id}/podcast/{podcast_id}/episode`
- [ ] Log and store real playlist and podcast IDs for each DJ for future use.
- [ ] Validate that metadata transformation (title, artist, album, genre) matches AzuraCast expectations.

#### Outcome:
- We can test real playlist lookups and confirm DJ-to-playlist mappings.
- We can verify metadata correctness without risking real uploads.

---

### 🚀 Step 2: Full Integration — Real Uploads and Scheduling

**Goal**: Replace all mock behavior with real API calls to complete the end-to-end upload and scheduling flow.

#### Tasks:
- [ ] Replace mock `uploadFile`, `setMetadata`, `addToPlaylist`, `schedulePlaylist`, and `addToPodcast` with real implementations.
- [ ] Ensure file path includes DJ subdirectory (e.g., `uploads/{djName}/filename.mp3`).
- [ ] Use real `media_id` returned from upload in all subsequent steps.
- [ ] Implement error handling and retry logic for each real API call.
- [ ] Confirm that scheduled playback and podcast publishing work as expected on the live server.

#### Outcome:
- The daemon can fully automate the upload, scheduling, and podcast publishing process using the live AzuraCast server.

---

### 🧪 One-Time Development Setup Notes

During development, especially when using a separate dev/test AzuraCast server, some setup steps may need to be performed once per environment:

- **Podcast ID Lookup**: The station has a single podcast. Its ID must be determined once via `GET /station/{station_id}/podcasts` and stored for reuse.
- **Playlist Discovery**: Playlists are matched dynamically by DJ name, so no static mapping is required.

To support this, we recommend implementing a standalone utility function (e.g., `runAzuraCastSetupTasks()`) that can be toggled on/off via a config flag. This function can:
- Fetch and log the podcast ID
- Optionally validate playlist availability for known DJ names
- Be run manually during environment setup or testing

## Key Data Structures

* **Source File Path**
  * Format: `/packages/daemon/received-files/{fileId}/{normalizedBase}.mp3`
  * Example: `/packages/daemon/received-files/74ce0458-b51b-4783-b721-fdbb23f012fc/2025-05-19_catalyst_m.mp3`
  * The `normalizedBase` is constructed from broadcast date, DJ name, and title

* **Destination File Path**
  * Format: `/var/azuracast/stations/{stationId}/files/{azuracast-file-id}.mp3` **NOTE: NEEDS UPDATED to include DJ-name in path**
  * Example: `/var/azuracast/stations/2/files/mock-azuracast-1747920290524.mp3`
  * The original filename is not preserved in the destination

* **AzuraCast Metadata Object**
  ```
  {
    title: "m",                    // From songlist.broadcast_data.setTitle
    artist: "catalyst",            // From songlist.broadcast_data.DJ
    album: "2025-05-22 Broadcast", // Constructed from CET date
    genre: "Electronic"            // From songlist.broadcast_data.genre (which comes from metadata.genre) or default "Radio Show"
  }
  ```
   **HOTE:** This appears incorrect; We'll need to do more around artist/album/..., setting it in the .mp3 metadata.

* **File ID Types**
  * Upload session ID: UUID generated when files are received (e.g., "74ce0458-b51b-4783-b721-fdbb23f012fc")
  * AzuraCast file ID: Generated by AzuraCast API as "mock-azuracast-{timestamp}" (e.g., "mock-azuracast-1747920290524")

## URL Construction

* **Base URL**: `https://radio.balearic-fm.com` (hardcoded in AzuraCastApi constructor)
* **API Endpoint**: `/api/station/{stationId}/files`
* **Station ID**: `2` (hardcoded in AzuraCastApiMock constructor)
* **Full URL**: `https://radio.balearic-fm.com/api/station/2/files`

## Key Observations

1. **URL Construction**:
   - The base URL is hardcoded in the AzuraCastApi constructor as `https://radio.balearic-fm.com`
   - The station ID is hardcoded in the AzuraCastApiMock constructor as `2` (for dev/test)
   - The full upload URL becomes: `https://radio.balearic-fm.com/api/station/2/files`

2. **File Path Transformation**:
   - Source file: `/packages/daemon/received-files/{fileId}/{normalizedBase}.mp3`
   - Destination path: `/var/azuracast/stations/2/files/{azuracast-file-id}.mp3`
   - The original filename is not preserved in the destination

3. **Metadata Transformation**:
   - The genre from the form (`metadata.genre`) is now properly used in the songlist
   - It's stored in `songlist.broadcast_data.genre` and then passed to AzuraCast
   - If no genre is provided in the form, it defaults to an empty string
   - The AzuraCastService uses this value or defaults to 'Radio Show' if empty

4. **File ID Usage**:
   - The `fileId` in console logs is a UUID for the entire upload session
   - It's used to create a directory for all files related to an upload
   - The AzuraCast file ID is generated by the AzuraCast API when the file is uploaded
   - In the mock implementation, it's generated as `mock-azuracast-{timestamp}`

5. **Upload Process**:
   - The upload is wrapped in a retry mechanism with up to 2 retries
   - The process has three steps: upload file, set metadata, add to playlist
   - Each step must succeed before proceeding to the next

## Potential Issues

1. **Hardcoded Values**:
   - The base URL and station ID are hardcoded, making it difficult to switch between environments
   - These should be moved to environment variables for easier configuration

2. **Filename Preservation**:
   - The original filename is not preserved when uploading to AzuraCast
   - This could make it difficult to identify files on the AzuraCast server

3. **Genre Handling**:
   - The genre from the form is now properly used in the songlist
   - The flow is clear: metadata.genre → songlist.broadcast_data.genre → AzuraCastMetadata.genre
   - This issue has been resolved in the current implementation
