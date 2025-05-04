# Destination APIs

This document outlines how the Upload Distributor daemon interacts with the public APIs of AzuraCast, Mixcloud, and SoundCloud.

## Overview

Each destination has its own authentication, upload, and metadata requirements. The daemon abstracts these differences and provides a unified upload interface.

---

## AzuraCast

### Authentication

- Uses API tokens per user.
- Tokens are validated via `/api/internal/me`.

### Upload

- Media is uploaded to a specific folder via `/api/station/:station_id/files`.
- Metadata is associated using `/api/station/:station_id/files/metadata`.

### Playlist Association

- Media is linked to a playlist using `/api/station/:station_id/playlists/:playlist_id/media`.

### Notes

- AzuraCast allows testing via a staging server.
- Supports robust metadata and playlist management.

---

## Mixcloud

### Authentication

- OAuth2-based authentication.
- Access tokens are stored per user.

### Upload

- Uploads are performed via `https://api.mixcloud.com/upload/`.
- Requires multipart form data with audio and metadata.

### Metadata

- Title, description, tags, and tracklist are supported.
- Tracklist is optional but recommended.

### Notes

- No test environment; uploads are live.
- Rate limits apply.

---

## SoundCloud

### Authentication

- OAuth2-based authentication.
- Access tokens are stored per user.

### Upload

- Uploads are performed via `https://api.soundcloud.com/tracks`.
- Requires multipart form data with audio and metadata.

### Metadata

- Title, genre, description, and sharing settings.
- Tracklist is not natively supported.

### Notes

- No test environment; uploads are live.
- Rate limits and content policies apply.

---

## Testing Strategy

- AzuraCast: Use a staging server for integration tests.
- Mixcloud/SoundCloud: Use mocks and stubs to simulate uploads.
- Validate metadata formatting and API request structure in tests.
