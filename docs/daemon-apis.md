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

#### `POST /api/auth/request-login`

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
  "message": "Magic link sent"
}
```

#### `POST /api/auth/verify-login`

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

#### `POST /api/auth/validate`

Validates an existing authentication token.

**Request**:
```json
{
  "token": "jwt-auth-token"
}
```

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

#### `GET /api/auth/profile`

Retrieves the user profile associated with the provided token.

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

#### `GET /api/auth/djs`

Returns a list of all users with DJ role from AzuraCast. Only accessible to Super Admin users.

**Request Headers**:
- `Authorization`: Bearer token

**Response**:
```json
{
  "success": true,
  "djs": [
    {
      "id": "dj-id",
      "email": "dj@example.com",
      "displayName": "DJ Name"
    }
  ]
}
```

### File Handling Endpoints

#### `POST /receive`

Receives files from clients (legacy endpoint).

**Request**:
Multipart form data with the following fields:

- `userId`: User ID string
- `title`: Title of the broadcast
- `djName`: Name of the DJ
- `broadcastDate`: Date of the broadcast
- `broadcastTime`: Time of the broadcast
- `genre`: Genre of the broadcast
- `description`: Description of the broadcast
- `azcFolder`: AzuraCast folder name
- `azcPlaylist`: AzuraCast playlist name
- `userRole`: User role (optional)
- `destinations`: Comma-separated list of destinations (optional)
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
  "status": "received",
  "message": "Files successfully received and validated"
}
```

#### `POST /upload`

Uploads files with support for DJ selection by Super Admins.

**Request**:
Multipart form data with the following fields:

- `title`: Title of the broadcast
- `broadcastDate`: Date of the broadcast
- `broadcastTime`: Time of the broadcast
- `genre`: Genre of the broadcast
- `description`: Description of the broadcast
- `azcFolder`: AzuraCast folder name
- `azcPlaylist`: AzuraCast playlist name
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
  "success": true,
  "fileId": "string",
  "status": "received",
  "message": "Files successfully received and validated"
}
```

#### `POST /send/process`

Processes files with enhanced metadata handling and pre-validated songlist support.

**Request**:
Multipart form data with the following fields:

- `metadata`: JSON string containing broadcast metadata
- `selectedDjId`: ID of DJ to upload as (optional, Super Admin only)
- `audio`: Audio file (.mp3)
- `songlist`: Songlist file (.txt, .rtf, .docx, .nml, .m3u8, .json)
- `artwork`: Artwork image file (.jpg/.png)

Headers:
- `Authorization`: Bearer token for authentication
- `x-file-id`: Optional file ID for testing/reuse

**Response**:
```json
{
  "success": true,
  "fileId": "string",
  "status": "received",
  "message": "Files successfully received and validated"
}
```

### Status Endpoints

#### `GET /status/:fileId`

Returns the status of file processing and destination uploads.

**Response**:
```json
{
  "fileId": "string",
  "status": "received|queued|processing|completed|error",
  "message": "string (optional)",
  "timestamp": "ISO date string",
  "metadata": {
    "userId": "string",
    "title": "string",
    "djName": "string",
    "broadcastDate": "string",
    "broadcastTime": "string",
    "genre": "string",
    "description": "string",
    "azcFolder": "string",
    "azcPlaylist": "string",
    "userRole": "string",
    "destinations": "string",
    "artworkFilename": "string"
  },
  "files": {
    "audio": {
      "exists": true,
      "size": 12345678
    },
    "songlist": {
      "exists": true,
      "size": 1234,
      "songCount": 15
    }
  },
  "archived": false
}
```

For archived files, additional fields are included:
```json
{
  "archived": true,
  "archivePath": "/path/to/archive/directory"
}
```

#### `GET /send/status/:fileId`

Returns the status of a file processed through the send endpoint.

**Response**:
```json
{
  "status": "received|queued|processing|completed|error",
  "message": "string (optional)",
  "timestamp": "ISO date string"
}
```

#### `GET /send/archive-status/:fileId`

Checks if a file has been archived and returns its status.

**Response**:
```json
{
  "success": true,
  "archived": true,
  "status": {
    "fileId": "string",
    "status": "completed",
    "message": "string",
    "timestamp": "ISO date string"
  }
}
```

### Songlist Parsing Endpoints

#### `POST /parse-songlist/validate`

Validates a songlist file without saving other files.

**Request**:
Multipart form data with the following fields:
- `songlist`: Songlist file (.txt, .rtf, .docx, .nml, .m3u8)
- `metadata`: JSON string containing metadata (optional)

**Response**:
```json
{
  "success": true,
  "songs": [
    {
      "title": "string",
      "artist": "string"
    }
  ]
}
```

#### `GET /parse-songlist/:fileId`

Parses a previously uploaded songlist file by its fileId.

**Response**:
```json
{
  "songs": [
    {
      "title": "string",
      "artist": "string"
    }
  ]
}
```

#### `POST /parse-songlist/:fileId/confirm`

Confirms parsed songs for a specific file ID and starts processing.

**Request**:
```json
{
  "songs": [
    {
      "title": "string",
      "artist": "string"
    }
  ]
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Songs confirmed successfully"
}
```

### Health Check

#### `GET /health`

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
  - `audio`: The audio file to be uploaded (.mp3 or other audio formats)
  - `songlist`: The tracklist information (supported formats: .txt, .rtf, .docx, .nml, .m3u8, .json)
  - `artwork`: Cover image for the broadcast (.jpg/.png)
- Temporary files are cleaned up after processing.
- Files are archived after successful processing.

## Security

- All endpoints require HTTPS in production.
- Input validation and rate limiting are enforced.
- Uploads are sandboxed in worker processes.
- Role-based access control for admin-only endpoints.
