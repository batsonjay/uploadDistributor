# Metadata and Songlist Data Flow

This document explains the relationship between metadata and songlist data structures in the Upload Distributor system, with a focus on how DJ information flows through the system.

## Data Structures

### 1. Metadata

The metadata object is created when a user uploads files through the web UI or CLI. It contains information about the upload, including:

- `title`: The title of the broadcast/set
- `broadcastDate`: The date of the broadcast (YYYY-MM-DD)
- `broadcastTime`: The time of the broadcast (HH:MM:SS)
- `genre`: The genre(s) of the broadcast, comma-separated
- `description`: A description of the broadcast
- `djName`: The name of the DJ
- `userId`: The ID of the user who uploaded the files
- `userRole`: The role of the user who uploaded the files
- `selectedDjId`: (Optional) The ID of the DJ selected by a Super Admin
- `artworkFilename`: The filename of the artwork

### 2. Songlist Data

The songlist data structure is created after parsing the uploaded songlist file. It contains:

```typescript
interface SonglistData {
  broadcast_data: {
    broadcast_date: string;
    broadcast_time: string;
    DJ: string;
    setTitle: string;
    genre: string[] | string;
    description: string;
    artwork: string;
  };
  track_list: Song[];
  version: string;
  user_role?: string;
}
```

## Data Flow

### 1. Upload Process

1. **Web UI / CLI Upload**:
   - User uploads audio, artwork, and songlist files
   - Metadata is collected from the form or CLI arguments
   - For Super Admins, a DJ can be selected using `selectedDjId`

2. **File Processing**:
   - Files are received by the daemon
   - Metadata is stored in `metadata.json`
   - If a Super Admin selected a DJ, the `djName` is set to the selected DJ's name

### 2. Songlist Creation

1. **Parsing**:
   - The songlist file is parsed to extract track information
   - If parsing fails, a minimal songlist is created from metadata

2. **Metadata to Songlist Conversion**:
   - The `broadcast_data` section of the songlist is populated from metadata:
     ```javascript
     songlist = {
       broadcast_data: {
         broadcast_date: metadata.broadcastDate,
         broadcast_time: metadata.broadcastTime,
         DJ: metadata.djName,
         setTitle: metadata.title,
         genre: genreArray, // Converted from comma-separated string
         description: metadata.description,
         artwork: metadata.artworkFilename
       },
       track_list: parseResult.songs,
       version: '1.0'
     };
     ```

### 3. DJ Information Flow

The DJ name flows through the system as follows:

1. **Initial Setting**:
   - For regular DJ users: `metadata.djName = user.displayName`
   - For Super Admins uploading on behalf of a DJ:
     ```javascript
     if (authUser.role === USER_ROLES.ADMIN && selectedDjId) {
       const selectedDj = await authService.getUserById(selectedDjId);
       if (selectedDj.success && selectedDj.user) {
         effectiveUser = selectedDj.user;
         // Later:
         metadata.djName = effectiveUser.displayName;
       }
     }
     ```

2. **Songlist Creation**:
   - `songlist.broadcast_data.DJ = metadata.djName`

3. **AzuraCast Upload**:
   - The DJ name is used to create AzuraCast metadata:
     ```javascript
     const metadata = {
       title: songlist.broadcast_data.setTitle,
       artist: songlist.broadcast_data.DJ, // DJ name used as artist
       album: `${cetDate} Broadcast`,
       genre: songlist.broadcast_data.genre.join(', ')
     };
     ```
   - The DJ name is also used to find the DJ's playlist:
     ```javascript
     const playlistResult = await this.findDjPlaylist(metadata.artist);
     ```

## Critical Points

### 1. DJ Name Consistency

It's critical that the DJ name is consistent throughout the system:

- The `metadata.djName` must match a DJ name in AzuraCast's playlist system
- When a Super Admin uploads on behalf of a DJ, the `selectedDjId` must be properly resolved to a DJ name
- The test script must explicitly set both `selectedDjId` and `djName` to ensure consistency

### 2. Playlist Lookup

The `findDjPlaylist` method in `AzuraCastService` uses the DJ name to find the corresponding playlist:

```javascript
const djNameLower = djName.toLowerCase();
const playlist = playlistsResult.playlists?.find(p => {
  const playlistNameLower = p.name.toLowerCase();
  return playlistNameLower === djNameLower || 
         playlistNameLower.includes(djNameLower) ||
         djNameLower.includes(playlistNameLower);
});
```

If the DJ name doesn't match any playlist name (case-insensitive), the upload will fail.

## Testing Considerations

When testing the upload process:

1. Ensure the test script sets both `selectedDjId` and `djName` to match a known DJ in the system
2. Verify that the DJ name matches a playlist name in AzuraCast
3. Check the logs for any errors related to playlist lookup
4. Monitor the `destination-status.log` file for success/error messages

## Troubleshooting

If uploads are failing due to DJ name issues:

1. Check the `metadata.json` file to verify the `djName` field
2. Check the AzuraCast API response for playlist lookup failures
3. Ensure the DJ name in the test script matches a known DJ in the system
4. Verify that the AzuraCast API mock or real API has playlists that match the DJ names being used
