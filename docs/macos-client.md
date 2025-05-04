# macOS Client

This document outlines the design and responsibilities of the Upload Distributor macOS client.

## Purpose

The macOS client provides a native-like desktop interface for DJs to upload `.mp3` and songlist files, enter metadata, and track upload status. It is inspired by the UX of FileZilla.

## Features

- Initial login prompt using AzuraCast credentials
- Persistent credential storage
- File browser for selecting `.mp3` and songlist files
- Metadata entry form
- Upload progress and status tracking
- Error display and retry options

## Authentication

- Prompts user for AzuraCast credentials on first launch
- Stores token securely (e.g., macOS Keychain)
- Token is reused for subsequent sessions
- Login button allows re-authentication

## Upload Flow

1. User launches app and logs in.
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
- Metadata is validated before submission.

## Testing

- Upload logic is modular and testable.
- Daemon API interactions are mockable.
- UI components are unit tested.

## UI/UX

- Built with Electron and React.
- FileZilla-like layout with file selection and status panel.
- Clear feedback on upload status and errors.
