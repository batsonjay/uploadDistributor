# Daemon APIs

This document defines the internal APIs exposed by the Upload Distributor daemon.

## Overview

The daemon exposes a RESTful API for use by the web and macOS clients. It handles file receiving, metadata submission, and status tracking. The daemon then processes these files and uploads them to destination platforms.

## Authentication

- Clients authenticate using email-based magic links.
- Authentication flow:
  1. Client requests a magic link for a user's email
  2. Daemon generates a secure token and sends a magic link to the user's email
  3. User clicks the link, which directs them to a verification page
  4. Verification page validates the token and completes the authentication
  5. JWT tokens are issued with role-based expiration (24h for DJs, 10y for Super Admins)
- Auth tokens are passed with each request via Authorization header or cookies.
- The daemon validates tokens before proceeding with any protected operation.
- After successful authentication, the daemon verifies that the DJ has a valid directory in AzuraCast.
- If the directory doesn't exist, the daemon returns an error to the client.

## Endpoints

### Authentication Endpoints

#### `POST /auth/request-login`

Requests a magic link for email-based authentication.

**Request**:
```json
{
  "email": "user@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Magic link sent to email"
}
```

#### `POST /auth/verify-login`

Verifies a magic link token and completes authentication.

**Request**:
```json
{
  "token": "secure-token-from-magic-link"
}
```

**Response**:
```json
{
  "success": true,
  "token": "jwt-auth-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "User Name",
    "role": "DJ" // or "ADMIN"
  }
}
```

#### `GET /auth/validate-token`

Validates an existing authentication token.

**Request Headers**:
- `Authorization`: Bearer token

**Response**:
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "displayName": "User Name",
    "role": "DJ" // or "ADMIN"
  }
}
```

### File Handling Endpoints

#### `POST /receive`

Receives files from clients.

**Request**:
Multipart form data with the following fields:

- `userId`: User ID string
- `title`: Title of the broadcast
- `djName`: Name of the DJ
- `azcFolder`: AzuraCast folder name
- `azcPlaylist`: AzuraCast playlist name
- `userRole`: User role (optional)
- `destinations`: Comma-separated list of destinations (optional)
- `selectedDjId`: ID of DJ to upload as (optional, Super Admin only)
- `audio`: Audio file (.mp3)
- `songlist`: Songlist file (.txt, .rtf, .docx, .nml, .m3u8)
- `artwork`: Artwork image file (.jpg/.png)

Headers:
- `Authorization`: Bearer token for authentication
- `x-file-id`: Optional file ID for testing/reuse

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

### `POST /parse-songlist`

Parses a songlist file and returns the extracted track information.

**Request**:
Multipart form data with the following field:
- `songlist`: Songlist file (.txt, .rtf, .docx, .nml, .m3u8)

**Response**:
```json
{
  "songs": [
    {
      "title": "string",
      "artist": "string"
    }
  ],
  "error": "NONE|FILE_READ_ERROR|NO_TRACKS_DETECTED|NO_VALID_SONGS|UNKNOWN_ERROR",
  "errorMessage": "string (optional)"
}
```

### `GET /parse-songlist/:fileId`

Parses a previously uploaded songlist file by its fileId.

**Response**:
```json
{
  "songs": [
    {
      "title": "string",
      "artist": "string"
    }
  ],
  "error": "NONE|FILE_READ_ERROR|NO_TRACKS_DETECTED|NO_VALID_SONGS|UNKNOWN_ERROR",
  "errorMessage": "string (optional)"
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
  - `songlist`: The tracklist information (supported formats: .txt, .rtf, .docx, .nml, .m3u8)
  - `artwork.jpg/png`: Cover image for the broadcast
- Temporary files are cleaned up after processing.

## Versioning

- All endpoints are versioned under `/v1/`.
- Future versions will maintain backward compatibility where possible.

## Security

- All endpoints require HTTPS.
- Input validation and rate limiting are enforced.
- Uploads are sandboxed in forked processes.
