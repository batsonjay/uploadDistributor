# Destination APIs

This document outlines how the Upload Distributor daemon interacts with the public APIs of AzuraCast, Mixcloud, and SoundCloud.

## Overview

Each destination has its own authentication, upload, and metadata requirements. The daemon abstracts these differences and provides a unified upload interface.

---

## AzuraCast

Note that some of the AzuraCast APIs require a "station shortcode". Let's call that the ":station_id" in this document.

- For the production station, the :station_id is 1
- For the development/test station, the :station_id is 2

### Authentication

- Uses API tokens per user.
- Tokens are validated via `/api/internal/me`.

### Upload

- Media is uploaded to a specific folder via `/api/station/:station_id/files`.
- Metadata is associated using `/api/station/:station_id/files/metadata`.

### Playlist Association

- Media is linked to a playlist using `/api/station/:station_id/playlists/:playlist_id/media`.

### Notes

- AzuraCast allows testing via a staging server. There is a staging server available at the 
- Supports robust metadata and playlist management.

---

## Mixcloud

### API documentation

- `https://www.mixcloud.com/DeVelopers/`.

### Authentication

- OAuth2-based authentication.
- Access tokens are stored per user.

### Upload

- Uploads are performed via `https://api.mixcloud.com/upload/`.
- Requires multipart form data with audio and metadata.

### Metadata

- Title, description, tags (used by this app to indicate genre), and tracklist are supported.
- Tracklist is supported, and the application / project here intends to supply a Tracklist.
- Set the field hosts-X-username to the DJ name
- Set field publish_date to the same as the set broadcast date & time
- **Artwork is required** and must be uploaded as part of the submission
- **Tags must include the genre** from the approved list (see songlists.md)

### Notes

- No test environment; uploads are live.
- Rate limits apply.

---

## SoundCloud

### API documentation

- `https://developers.soundcloud.com/docs#uploading`
- `https://developers.soundcloud.com/docs/api/explorer/open-api`

### Authentication

- OAuth2-based authentication.
- Access tokens are stored per user.

### Upload

- SoundCloud requires a two-step process:
  1. First, upload the audio file via `https://api.soundcloud.com/tracks` (POST)
  2. Then, update the track metadata via `https://api.soundcloud.com/tracks/{track_id}` (PUT)
- Both steps require proper authentication.
- The first step returns a track ID that must be used in the second step.

### Metadata

- Title, genre, description, and sharing settings.
- **Artwork is required** and must be uploaded as part of the submission.
- **Genre must be from the approved list** (see songlists.md).
- Tracklist is not natively supported in the API, but can be included in the description.
- Sharing settings can be 'public' or 'private'.
- Additional fields supported: tags, purchase_url, license, release_date, isrc, bpm.

### Notes

- No test environment; uploads are live.
- Rate limits and content policies apply.

---

## Testing Strategy

- AzuraCast: Use the dev/test server for integration tests. However, implement mocks & stubs for initial development prior to testing against that server.
- Mixcloud/SoundCloud: Use mocks and stubs to simulate uploads.
- Validate metadata formatting and API request structure in tests.
