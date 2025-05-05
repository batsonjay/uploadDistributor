# Shared Client Requirements

This document outlines the common requirements and considerations that apply to both the web client and macOS client for the Upload Distributor application.

## User Roles

The client must handle two distinct user roles with different permissions and interfaces:

### DJ Role
- Basic upload capabilities
- Limited visibility into destination details
- Simplified error reporting
- Upload considered complete once file is sent to daemon

### Admin Role
- Advanced upload capabilities
- Full visibility into all destinations
- Detailed error reporting
- Ability to upload to individual or all destinations
- Upload considered complete only after all destination results are received

## Authentication

- Both clients must authenticate users via AzuraCast credentials.
- Upon successful authentication, clients should retrieve the DJ's display name and role from AzuraCast.
- The DJ's display name will be used for:
  - AzuraCast playlist association
  - Mixcloud host username
  - SoundCloud playlist naming

## File Validation

### Audio Files

- Clients must validate that uploaded audio files are in MP3 format.
- Audio files should be checked for minimum 20 minute length (all uploads will be minimum 1 hour in practice).

### Artwork Requirements

- Artwork must be included with all uploads.
- Artwork should be 1440px square (as specified by Apple Podcasts).
- Both JPG and PNG formats are acceptable, but this should be confirmed with Mixcloud and SoundCloud.

## Metadata Validation

- All required metadata fields must be validated before submission to the daemon:
  - Title
  - DJ Name (retrieved from AzuraCast)
  - Broadcast date/time
  - Genre (must be from the approved list in songlists.md)
  - Artwork

## Timezone Handling

- All date/time fields in the client UI should be clearly labeled as Central European (Summer) Time.
- The client will collect all date/time information in Central European Time.
- When creating the JSON "master" songfile document, the client will convert all timestamps to UTC for storage.
- When the daemon sends data to destinations, it will convert the UTC timestamps back to Central European Time for each destination:
  - AzuraCast: Use Central European Time for setting Playlist date/time.
  - Mixcloud: Convert to UTC, but set the publication date/time to match what would be displayed in CET.
  - SoundCloud: Same as Mixcloud - convert to UTC while preserving the CET time display.

## Error Handling

### DJ Role Error Handling
- DJ users should only see basic error information about their upload to the daemon.
- DJ users should not see information about multiple destinations.
- For DJ users, the upload is considered complete once the file is successfully uploaded to the daemon.
- Authentication errors and file upload errors to the daemon should be clearly communicated to DJ users.

### Admin Role Error Handling
- Admin users should see detailed error information for all destinations.
- For destination-specific errors, admin users should see which service had an error.
- Admin users should have retry options for failed uploads to specific destinations.
- Admin users should be able to see the status of each destination upload individually.
- For admin users, the upload is considered complete only after receiving results from all destinations.

## Upload Flow

### DJ Role Upload Flow
1. DJ user logs in and is identified as having the DJ role.
2. DJ user selects files and enters metadata.
3. Client validates all data and files.
4. Client sends data to daemon via `POST /upload`.
5. Once the upload to the daemon is complete, the client informs the DJ user that the upload was successful.
6. The daemon handles uploads to all destinations in the background without further client interaction.

### Admin Role Upload Flow
1. Admin user logs in and is identified as having the Admin role.
2. Admin user selects files, enters metadata, and can optionally select which destinations to upload to.
3. Client validates all data and files.
4. Client sends data to daemon via `POST /upload` with destination preferences.
5. Client polls `GET /status/:uploadId` for progress on all destination uploads.
6. Client displays detailed status for each destination upload to the admin user.
7. Client provides retry options for any failed destination uploads.

## User Interface

- Both clients should clearly indicate upload progress and status appropriate to the user's role.
- Admin interface should provide a way to view historical uploads and their status across all destinations.
- DJ interface should provide a way to view their own historical uploads.
- Both clients should make it clear that all dates are in Central European (Summer when applicable) Time.
- Admin interface should include controls for selecting individual destinations for upload.
