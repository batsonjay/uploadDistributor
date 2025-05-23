# AzuraCast Upload Flow

This document outlines the flow of data and processes involved in uploading files to AzuraCast from the Upload Distributor daemon, from the point where "Starting upload to AzuraCast..." is logged to "AzuraCast upload completed successfully".

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
  * The genre now properly comes from the form submission via metadata.genre → songlist.broadcast_data.genre

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
  * **Step 1: Upload the file**
    * Calls `api.uploadFile(audioFilePath, metadata)`
    * Sends the file to `https://radio.balearic-fm.com/api/station/2/files`
    * If successful, returns `{success: true, id: fileId, path: destinationPath}`
    * If unsuccessful, logs error and throws exception to trigger retry

  * **Step 2: Set metadata**
    * Only proceeds if Step 1 was successful
    * Calls `api.setMetadata(uploadResult.id, metadata)`
    * Associates the metadata with the uploaded file
    * If unsuccessful, logs error and throws exception to trigger retry

  * **Step 3: Add to playlist**
    * Only proceeds if Step 2 was successful
    * Calls `api.addToPlaylist(uploadResult.id)`
    * Adds the file to playlist ID "1" (default playlist)
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

## Key Data Structures

* **Source File Path**
  * Format: `/packages/daemon/received-files/{fileId}/{normalizedBase}.mp3`
  * Example: `/packages/daemon/received-files/74ce0458-b51b-4783-b721-fdbb23f012fc/2025-05-19_catalyst_m.mp3`
  * The `normalizedBase` is constructed from broadcast date, DJ name, and title

* **Destination File Path**
  * Format: `/var/azuracast/stations/{stationId}/files/{azuracast-file-id}.mp3`
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
