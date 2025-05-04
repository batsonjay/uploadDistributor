# Web Client

This document outlines the design and responsibilities of the Upload Distributor web client.

## Purpose

The web client provides a browser-based interface for DJs to upload `.mp3` and songlist files, enter metadata, and track upload status.

## Features

- AzuraCast login page
- Upload form for `.mp3` and songlist files
- Metadata entry (title, DJ name, etc.)
- Upload progress and status tracking
- Error display and retry options

## Authentication

- Users log in via AzuraCast credentials.
- Auth token is stored in session/local storage.
- Token is sent with each API request to the daemon.

## Upload Flow

1. User logs in.
2. User selects `.mp3` and songlist files.
3. User enters metadata.
4. Client sends data to daemon via `POST /upload`.
5. Client polls `GET /status/:uploadId` for progress.

## Metadata Handling

- Metadata fields:
  - Title
  - DJ Name
  - AzuraCast Folder
  - AzuraCast Playlist
- Metadata is validated client-side before submission.

## Testing

- Upload logic is modular and testable.
- Mock daemon endpoints for integration testing.
- Form validation and error handling are unit tested.

## UI/UX

- Built with React.
- Responsive design for desktop and mobile.
- Clear feedback on upload status and errors.
