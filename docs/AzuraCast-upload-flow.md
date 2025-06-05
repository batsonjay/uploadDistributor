# AzuraCast Upload Flow

This document outlines the flow of data and processes involved in uploading files to AzuraCast from the Upload Distributor daemon, from the point where "Starting upload to AzuraCast..." is logged to "AzuraCast upload completed successfully".

## Update as of 2025-05-27 06:55:00pm
This document was created early in the process of building the app. It may still show some vestiages of history, but is largely updated with revised information on how this upload is to be done. Much of the work that must be done is to get rid of code that was placeholder-code & mocks that were done early, but incorrectly, just to get other aspects of the application working correctly. The next task is to make proper code for this section of the application.

* **Related, but un-described work: Provide upload progress reporting / status**
  * The web-ui is designed to provide upload progress indication of the .mp3 file. Most will be large. Because the development so far has used small .mp3 files in order to get initial code in place, an upload of a large file has not been tested. This matters because the mock will need to be prepared to receive a large file. In addition, code is needed as part of this work to provide a way for the web-ui to display upload progress.

* **Mock needs major rework**
  * A review of the code in the mock suggests that it currently inadequately models the AzuraCast APIs that are necessary to use. The full API documentation for each API call is available at https://radio.balearic-fm.com/docs/api/, including both the syntax for sending as well as all responses, and the schema.

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

  * **Step 2: Set metadata**
    * Only proceeds if Step 1 was successful
    * Calls `api.setMetadata(uploadResult.id, metadata)`
    * Associates the metadata with the uploaded file using the fileId returned in Step 1
    * If unsuccessful, logs error and throws exception to trigger retry

  * **Step 3: Add to DJ playlist**
    * Only proceeds if Step 2 was successful
    * Calls `api.xxx`
    * Obtain the Playlist ID for the DJ
    * (ALERT: THIS SEEMS INCOMPLETE. HAVE AI AGENT FIX.) Calls `api.addToPlaylist(uploadResult.id)`to associate the uploaded file with the DJ's playlist.
    * Adds the file to playlist associated with the DJ
    * Uses the metadata to set up the playlist with the date & time for play
    * If unsuccessful, logs error and throws exception to trigger retry


  * **Step 4: Add to podast**
    * Calls `api.yyy`
    * Sends relevant metadata to set episode description text and the date and time on which the episode will be published (which is the "end" date / time as play is set in the prior step)
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

## Implementation Plan

Implementation will be done using a hybrid plan, initially making GET calls directly to the AzuraCast server but using a Mock for any POST calls. After the PUTs seems appropriate, the service will switch to calling the AzuraCast server instead of the mocks. Note that the AzuraCast server has 2 "stations". Station 1 is the live/production server; station 2 is availale for development / test use. The implementation should declare the station number as a constant, and set it to 2 until ready for use on the live station, when the constant is changed to 1.

### Mock Implementation

 The mock implementation allows for safe local development and testing of the media upload and playlist scheduling flow using the AzuraCast API. This mock should replicate the behavior and data structure of the real API to allow the front-end React app to simulate the complete flow without calling the live service.

---

### Required End-to-End Flow

The full flow that must be mocked includes:

1. **Receive Media File Upload**
2. **Receive Metadata Update**
3. **Set Playback Time on Playlist**
4. **Add Media to Podcast Feed** (deferred)

Each of these steps requires interaction with a specific AzuraCast API endpoint and returns JSON responses the mock must reproduce accurately.

---

### Step-by-Step Responsibilities

#### 1. Receive a Media File

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

#### 2. Receive Metadata Update

**API Path**:  
`POST /station/{station_id}/file/{id}`

**Request JSON**
```json
{
  "artist": "{{songlist.broadcast_data.DJ}}",
  "title": "{{songlist.broadcast_data.setTitle}}",
  "album": "{{songlist.broadcast_data.setTitle}}",
  "genre": "{{songlist.broadcast_data.genre}}",
  "playlist": [
    "{{DJ-playlist-id}}", // Presumes AzuraCast Service has obtained the playlist ID for the specific DJ
    "{{Podcast-playlist-ID}}" // Presumes AzuraCast Servive has obtained the playlist ID for the (one) Podcast
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

#### 3. Set Playback Time for Playlist

**API Path**:  
`PUT /station/{station_id}/playlist/{playlist_id}`

**Request JSON**:
```json
{
  "schedule_items": [
    {
      "start_date": Uses `songlist.braodcast_data.broadcast_date`,
      "start_time": Uses `songlist.broadcast_data.broadcast_time`,
      "end_time": Add one hour to the start_time and provide it here, 
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

#### 4. Add Media to Podcast Feed

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

### ✅ Step 1: Hybrid Mode — Real Lookups, Mock Uploads

**Goal**: Enable partial integration with the live AzuraCast server to validate connectivity and metadata correctness, while retaining mock behavior for uploads and playlist modifications.

#### Tasks:
- [ ] Refactor `AzuraCastService` to accept a real `AzuraCastApi` instance (not just the mock).
- [ ] Introduce a configuration flag (e.g., `USE_AZURACAST_MOCKS`) to toggle mock behavior.
- [ ] Implement real API calls for:
  - `GET /station/{station_id}/playlists`
  - `GET /station/{station_id}/podcasts` (deferred until AzuraCast podcast )
- [ ] Use mock for:
  - `POST /station/{station_id}/files`
  - `POST /station/{station_id}/playlist/{playlist_id}/media`
  - `PUT /station/{station_id}/playlist/{playlist_id}`
- [ ] Validate that metadata transformation (title, artist, album, genre) matches AzuraCast expectations.

#### Outcome:
- We can test real playlist lookups and confirm DJ-to-playlist mappings.
- We can verify metadata correctness without risking real uploads.

---

### 🚀 Step 2: Full Integration — Real Uploads and Scheduling

**Goal**: Replace all mock behavior with real API calls to complete the end-to-end upload and scheduling flow.

#### Tasks:
- [ ] Replace mock `uploadFile`, `setMetadata`, `addToPlaylist` and `schedulePlaylist` with real implementations.
- [ ] Ensure file path includes DJ subdirectory (e.g., `uploads/{djName}/filename.mp3`).
- [ ] Use real `media_id` returned from upload in all subsequent steps.
- [ ] Implement error handling and retry logic for each real API call.
- [ ] Confirm that scheduled playback work as expected on the live server.

#### Outcome:
- The daemon can fully automate the upload and playlist scheduling using the live AzuraCast server.

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
