# AzuraCast Upload Flow Diagram

This diagram illustrates the flow of data and processes involved in uploading files to AzuraCast from the Upload Distributor daemon, from the point where "Starting upload to AzuraCast..." is logged to "AzuraCast upload completed successfully".

## Flow Diagram

```mermaid
sequenceDiagram
    participant FP as file-processor.ts
    participant SM as StatusManager
    participant AZS as AzuraCastService
    participant AZA as AzuraCastApi
    participant AZM as AzuraCastApiMock
    participant AZ as AzuraCast Server

    Note over FP: Log: "Starting upload to AzuraCast..."
    FP->>SM: updateStatus("processing", "Uploading to AzuraCast")
    
    %% Metadata Creation
    FP->>AZS: createMetadataFromSonglist(songlist)
    AZS-->>FP: Return AzuraCast metadata
    Note over AZS: Transform songlist data to AzuraCast format:<br/>- title: from songlist.broadcast_data.setTitle<br/>- artist: from songlist.broadcast_data.DJ<br/>- album: CET date + ' Broadcast'<br/>- genre: from songlist.broadcast_data.genre
    
    %% Upload Process with Retry
    Note over FP: Wrap upload in retry utility<br/>(max retries: 2, initial delay: 1000ms)
    
    %% Step 1: Upload File
    FP->>AZS: uploadFile(audioFile, azuraCastMetadata)
    AZS->>AZA: uploadFile(audioFilePath, metadata)
    
    alt USE_REAL_AZURACAST=true
        AZA->>AZ: POST /api/station/1/files
        AZ-->>AZA: Return {success, id, path}
    else USE_REAL_AZURACAST=false
        AZA->>AZM: uploadFile(audioFilePath, metadata)
        AZM-->>AZA: Return mock {success, id, path}
    end
    
    AZA-->>AZS: Return upload result
    
    alt Upload Failed
        AZS->>SM: Log error
        AZS-->>FP: Throw exception (triggers retry)
    end
    
    %% Step 2: Set Metadata
    AZS->>AZA: setMetadata(uploadResult.id, metadata)
    
    alt USE_REAL_AZURACAST=true
        AZA->>AZ: POST /api/station/1/files/{id}/metadata
        AZ-->>AZA: Return success/error
    else USE_REAL_AZURACAST=false
        AZA->>AZM: setMetadata(id, metadata)
        AZM-->>AZA: Return mock success/error
    end
    
    AZA-->>AZS: Return metadata result
    
    alt Metadata Failed
        AZS->>SM: Log error
        AZS-->>FP: Throw exception (triggers retry)
    end
    
    %% Step 3: Add to Playlist and Podcast
    AZS->>AZA: lookupPlaylistByDj(djName)
    
    alt USE_REAL_AZURACAST=true
        AZA->>AZ: GET /api/station/1/playlists
        AZ-->>AZA: Return playlists
    else USE_REAL_AZURACAST=false
        AZA->>AZM: lookupPlaylistByDj(djName)
        AZM-->>AZA: Return mock playlist ID
    end
    
    AZA-->>AZS: Return playlist ID
    
    AZS->>AZA: addToPlaylist(uploadResult.id, playlistId)
    
    alt USE_REAL_AZURACAST=true
        AZA->>AZ: POST /api/station/1/playlist/{playlist_id}/media
        AZ-->>AZA: Return success/error
    else USE_REAL_AZURACAST=false
        AZA->>AZM: addToPlaylist(id, playlistId)
        AZM-->>AZA: Return mock success/error
    end
    
    AZA-->>AZS: Return playlist result
    
    AZS->>AZA: setPlaybackTime(playlistId, scheduleData)
    
    alt USE_REAL_AZURACAST=true
        AZA->>AZ: PUT /api/station/1/playlist/{playlist_id}
        AZ-->>AZA: Return success/error
    else USE_REAL_AZURACAST=false
        AZA->>AZM: setPlaybackTime(playlistId, scheduleData)
        AZM-->>AZA: Return mock success/error
    end
    
    AZA-->>AZS: Return schedule result
    
    AZS->>AZA: addToPodcast(uploadResult.id, podcastMetadata)
    
    alt USE_REAL_AZURACAST=true
        AZA->>AZ: POST /api/station/1/podcast/1eee034e-345c-6a8e-aaf3-ad260532e878/episode
        AZ-->>AZA: Return success/error
    else USE_REAL_AZURACAST=false
        AZA->>AZM: addToPodcast(id, podcastMetadata)
        AZM-->>AZA: Return mock success/error
    end
    
    AZA-->>AZS: Return podcast result
    
    alt Add to Playlist/Podcast Failed
        AZS->>SM: Log error
        AZS-->>FP: Throw exception (triggers retry)
    end
    
    %% Success Handling
    AZS-->>FP: Return success result
    FP->>SM: Log success with details
    Note over FP: Log: "AzuraCast upload completed successfully"
```

## Key Components

1. **file-processor.ts**: Initiates the upload process and handles the overall flow
2. **StatusManager**: Updates and tracks the status of the upload process
3. **AzuraCastService**: Orchestrates the three-step upload process and handles retries
4. **AzuraCastApi**: Interface for communicating with the AzuraCast server
5. **AzuraCastApiMock**: Mock implementation for development/testing
6. **AzuraCast Server**: The actual AzuraCast server that receives the uploads

## Implementation Notes

- The system uses a configuration flag (`USE_REAL_AZURACAST`) to toggle between real API calls and mock behavior
- The upload process is wrapped in a retry mechanism with up to 2 retries
- The podcast ID (1eee034e-345c-6a8e-aaf3-ad260532e878) was determined through the one-time setup process
- DJ playlists are looked up dynamically by matching the DJ name against playlist names (case-insensitive)
- The system found the following exact DJ-playlist mappings on station 1 (production):
  - Ali → playlist ID 50 (Ali)
  - Andre Rehage → playlist ID 66 (Andre Rehage)
  - Chewee → playlist ID 1 (Chewee)
  - DJ Takafusa → playlist ID 9 (DJ Takafusa)
  - GIUGRI.J → playlist ID 39 (GIUGRI.J)
  - Ian Douglass → playlist ID 16 (Ian Douglass)
  - JIB → playlist ID 61 (JIB)
  - Kate Alderman → playlist ID 45 (Kate Alderman)
  - Liz Dreher → playlist ID 44 (Liz Dreher)
  - Moody Silvs → playlist ID 58 (Moody Silvs)
  - Paul Sweeney → playlist ID 65 (Paul Sweeney)
  - phr0ggi → playlist ID 60 (Phr0ggi)
  - Trafelo → playlist ID 11 (Trafelo)
- The process follows a phased integration approach as outlined in the implementation plan
