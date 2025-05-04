# Architecture

This document outlines the overall system design and operational flow of the Upload Distributor project.

## System Overview

Development is performed locally on macOS, with final deployment on Linux systems. All components are designed to run on macOS for development purposes.

The system is composed of three main components:

- **Daemon**: Core processing unit that handles uploads and distribution.
- **Web Client**: Browser-based interface for users to upload and manage content.
- **macOS Client**: Desktop application for macOS with a FileZilla-like UX.

## Upload Flow

1. User uploads an `.mp3` file and a songlist file via a client.
2. The client sends the files and metadata to the daemon via its API.
3. The daemon forks a process to handle the upload.
4. The forked process:
   - Stores the media file transiently.
   - Normalizes and stores the songlist persistently.
   - Uploads the media to AzuraCast, Mixcloud, and SoundCloud.
   - Associates metadata and logs the result.

## Concurrency Model

- The daemon forks a new process for each upload.
- Each process is isolated and exits upon completion.
- This model ensures scalability and fault isolation.

## File Storage

- **Media Files**: Stored transiently by the daemon during processing.
- **Songlist Files**: Persistently stored in a structured format (e.g., JSON or database).

## Metadata Handling

- Metadata is entered per-upload by the user.
- Each user is associated with:
  - A media folder on AzuraCast.
  - A playlist on AzuraCast.
- This mapping is stored and used during upload.

## Authentication

- Clients authenticate users via the AzuraCast API.
- Web client provides a login page.
- macOS client prompts on first launch and stores credentials securely.

## Logging and Monitoring

- Each upload process logs its actions and errors.
- Centralized logging for daemon and clients.
- Monitoring hooks for health checks and alerts.

## Testing and CI/CD

- Daemon and clients include hooks for testability.
- Mixcloud and SoundCloud uploads are stubbed/mocked in tests.
- AzuraCast uploads can be tested against a staging server.
- CI/CD pipeline includes linting, unit tests, and integration tests.
