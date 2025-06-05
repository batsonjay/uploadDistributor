# Architecture

This document outlines the overall system design and operational flow of the Upload Distributor project. For detailed flow diagrams, see [Architecture Flow Diagrams](./architecture-flow.md).

## System Overview

Development is performed locally on macOS, with final deployment on Linux systems. All components are designed to run on macOS for development purposes.

The system is composed of three main components:

- **Daemon**: Core processing unit that handles uploads and distribution.
- **Web Client**: Browser-based interface for users to upload and manage content.
- **macOS Client**: Desktop application for macOS

## Upload Flow

1. User uploads an `.mp3` file and associated metadata (collected into a songlist file) via a client.
2. The client sends the files and metadata to the daemon via its API.
3. The daemon parses the songlist, returning the parsed results to the client for validation or correction
4. After receiving the validated songlist data, the daemon creates a worker thread to handle the upload.
5. The worker thread:
   - Stores the media file transiently.
   - Normalizes and stores the songlist persistently.
   - Uploads the media to AzuraCast, Mixcloud, and SoundCloud.
   - Associates metadata and logs the result.

## Concurrency Model

- The daemon creates a new worker thread for each upload.
- Each worker thread is isolated and exits upon completion.
- This model ensures scalability and fault isolation while being more efficient than process forking.

## File Storage

- **Media Files**: Stored transiently by the daemon during processing.
- **Songlist Files**: Persistently stored in the daemon's file system using structured directory & file names.

## Metadata Handling

- Metadata is entered per-upload by the user.
- Each user is associated with:
  - A Dj account on AzuraCast (validated during initial client authentication)
  - A media folder on AzuraCast.
  - A playlist on AzuraCast.
- This mapping is stored and used during upload.

## Authentication

- Clients authenticate users via email-based magic links.
- Authentication flow:
  - Users enter their email address on the login screen
  - System sends a magic link to their email
  - User clicks the link to authenticate
  - System verifies the email and retrieves user information from AzuraCast
- Role-based token expiration:
  - DJ tokens expire after 24 hours
  - Super Admin tokens expire after 10 years
- Web client provides a login page with email input.
- macOS client prompts on first launch and stores authentication tokens securely.

## Logging

- The daemon implements a comprehensive logging system based on enabled & disabled categories:
- Log messages include bracketed labels indicating the source (e.g., `[M3U8Parser]`) and a unique ID (e.g., [MP:01])
- Timestamps are included in selected log entries, predominantly when timing is important
- Configurable logging via environment variables:

## Testing and CI/CD

- Daemon and clients are intended to include hooks for testability; support is uneven.
- AzuraCast uploads can be tested against a staging server.
- Mixcloud and SoundCloud uploads are stubbed/mocked pending more complete development
- CI/CD pipeline should linting, unit tests, and integration tests; it does not currently exist


## Development testing

### Azuracast development server

[Destination APIs](docs/destination-apis.md) provides information on an AzuraCast server available for dev/test as well as a discussion of the mocks & stubs required for development before attempting to test against live services, which have no test capability.
