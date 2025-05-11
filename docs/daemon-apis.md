# Daemon APIs

This document defines the internal APIs exposed by the Upload Distributor daemon.

## Overview

The daemon exposes a RESTful API for use by the web and macOS clients. It handles file receiving, metadata submission, and status tracking. The daemon then processes these files and uploads them to destination platforms.

## Authentication

- Clients authenticate using AzuraCast credentials.
- Auth tokens are passed with each request.
- The daemon validates tokens with AzuraCast before proceeding.
- After successful authentication, the daemon verifies that the DJ has a valid directory in AzuraCast.
- If the directory doesn't exist, the daemon returns an error to the client.

## Endpoints

### `POST /receive`

Receives files from clients.

**Request Body**:
```json
{
  "userId": "string",
  "authToken": "string",
  "metadata": {
    "title": "string",
    "djName": "string",
    "azcFolder": "string",
    "azcPlaylist": "string"
  },
  "files": {
    "audio": "base64-encoded .mp3",
    "songlist": "base64-encoded songlist file",
    "artwork": "base64-encoded image file (jpg/png)"
  }
}
```

**Response**:
```json
{
  "fileId": "string",
  "status": "received"
}
```

### `GET /status/:fileId`

Returns the status of file processing and destination uploads.

**Response**:
```json
{
  "fileId": "string",
  "status": "queued|processing|completed|error",
  "message": "string (optional)"
}
```

### `GET /health`

Health check endpoint.

**Response**:
```json
{
  "status": "ok"
}
```

## Error Handling

- Standard HTTP status codes are used.
- Error responses include a `message` field for debugging.
- Specific error messages are provided for common issues:
  - Authentication failures: "Invalid credentials"
  - Directory verification failures: "Media upload folder name mismatch; inform station administrator"
  - File validation failures: "Invalid file format"

## File Handling

- Uses `Busboy` to stream large files directly to disk.
- Avoids buffering entire files in memory to support files up to 200MB+.
- Express is configured to bypass default body parsers for multipart data.
- Files are stored in the `received-files` directory.
- Each upload requires three files:
  - `audio.mp3`: The audio file to be uploaded
  - `songlist.txt`: The tracklist information
  - `artwork.jpg/png`: Cover image for the broadcast
- Temporary files are cleaned up after processing.

## Versioning

- All endpoints are versioned under `/v1/`.
- Future versions will maintain backward compatibility where possible.

## Security

- All endpoints require HTTPS.
- Input validation and rate limiting are enforced.
- Uploads are sandboxed in forked processes.
