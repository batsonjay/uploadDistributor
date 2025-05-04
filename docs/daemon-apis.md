# Daemon APIs

This document defines the internal APIs exposed by the Upload Distributor daemon.

## Overview

The daemon exposes a RESTful API for use by the web and macOS clients. It handles upload initiation, metadata submission, and status tracking.

## Authentication

- Clients authenticate using AzuraCast credentials.
- Auth tokens are passed with each request.
- The daemon validates tokens with AzuraCast before proceeding.

## Endpoints

### `POST /upload`

Initiates a new upload.

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
    "songlist": "base64-encoded songlist file"
  }
}
```

**Response**:
```json
{
  "uploadId": "string",
  "status": "queued"
}
```

### `GET /status/:uploadId`

Returns the status of an upload.

**Response**:
```json
{
  "uploadId": "string",
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

## Upload Handling

- Uses `Busboy` to stream large file uploads directly to disk.
- Avoids buffering entire files in memory to support uploads up to 200MB+.
- Express is configured to bypass default body parsers for multipart data.
- Temporary files are cleaned up after processing.

## Versioning

- All endpoints are versioned under `/v1/`.
- Future versions will maintain backward compatibility where possible.

## Security

- All endpoints require HTTPS.
- Input validation and rate limiting are enforced.
- Uploads are sandboxed in forked processes.
