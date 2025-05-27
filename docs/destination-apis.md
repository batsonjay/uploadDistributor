# Destination APIs

This document outlines how the Upload Distributor daemon interacts with the public APIs of AzuraCast, Mixcloud, and SoundCloud.

## Overview

Each destination has its own authentication, upload, and metadata requirements. The daemon abstracts these differences and provides a unified upload interface.

---

## AzuraCast

> ⚠️ **Note**: The AzuraCast upload integration is currently non-functional. The following describes the intended design, not the current working state.

### API documentation
- `https://www.azuracast.com/docs/developers/apis/`
- `https://www.azuracast.com/api/`

Note that some of the AzuraCast APIs require a "station shortcode". Let's call that the ":station_id" in this document.

- For the production station, the :station_id is 1
- For the development/test station, the :station_id is 2

### Authentication

- Uses API tokens per user.
- Tokens are validated via `/api/internal/me`.

### Upload

- The station is accessed at `https://radio.balearic-fm.com`.
- Media is uploaded to a specific folder via `/api/station/:station_id/files`.
- Metadata is associated using `/api/station/:station_id/files/metadata`.

### Playlist Association

- Media is linked to a playlist using `/api/station/:station_id/playlists/:playlist_id/media`.

### Error Handling Considerations

#### Question 1: File Format Validation
How should we handle file format validation errors from AzuraCast?

#### Decision 1:
The daemon will normalize all information prior to sending it to AzuraCast, so errors are not to be commonly expected. File format validation is primarily handled by the client. See [Shared Client Requirements - File Validation](./shared-client-requirements.md#file-validation).

This suggests, though, that the application should have a log files for logging destination activity. I'd like a one log that shows both success and failure, with one line only per-destination completion (success or failure). The structure for the content of this message is (using a meta-type description):
- `[service-name]: [success | error] [yyyy-mm-dd hh:mm]: songfile.title, success/error value`

I want a separate file for more detail on errors. (Success is not included in this file.) The detailed error log structure should be:
```
[service-name] [yyyy-mm-dd hh:mm]: ERROR
Title: songfile.title
Error Type: [authentication|validation|network|server|unknown]
Error Message: [original error message]
Request Details: [relevant request data that caused the error]
Attempt: [1|2|3] of 3
```

#### Question 2: API Rate Limiting
How should we handle rate limit errors from AzuraCast?

#### Decision 2:
Don't handle this error. I understand the rate limits, and can manually avoid them.

#### Question 3: Station Quota Limits
How should we handle storage quota exceeded errors?

#### Decision 3:
Don't handle this error. I track storage capacity and manage it regularly outside of this application.

#### Question 4: Playlist Conflicts
How should we handle the case where a playlist is deleted between file upload and playlist association?

#### Decision 4:
Don't handle this error. Playlist creation / deletion is only done by me, and is infrequent, and intentional.

HOWEVER, it does suggest that I need some way to configure the list of active DJs, because DJ display names represent valid Playlist names on Azuracast, "Host" names in the Mixcloud uploads, and "Playlist" names in the Soundcloud uploads.

This is handled through the authentication flow in the clients. See [Shared Client Requirements - Authentication](./shared-client-requirements.md#authentication).

The client (web and macOS) authenticates the user using AzuraCast usernames (email address). Upon authentication, the AzuraCast API retrieves the Display Name of the DJ, which is used for all three purposes above.

If a user can't properly authenticate within the client, we prevent the use of incorrect playlist names, thus indirectly avoiding any playlist conflict.

#### Question 5: Permission Hierarchy
How should we handle permission-related errors where a user can upload but not modify playlists?

#### Decision 5: 
Don't hanele this error. I'll resolve this by controlling permissions at the station. Remember that there are two auths:
- User authentication within the client talking to the daemon. We'll handle this as above in Decision 4.
- User authentication within the daemon talking to the destinations. We'll always use the same, single login for the station at each destination.

If we do have an auth error for either case, log it in the error log mentioned above.

#### Question 6: Error Recovery Strategy
Should we implement automatic retries for network failures but not validation errors?

#### Decision 6:
Yes, but only up to 3 times, with backoff. I can always try again later.

#### Question 7: User Notification Detail
What level of error detail should be exposed to users vs. administrators?

#### Decision 7:
We need to distinguish between errors encountered by the daemon & those encountered by users.
- Daemon errors need to be communicated back to the user only in a general form indicating which destination had the error, and that there *was* an error, but it does not need to be specified.
- Daemon errors also need logged to file as specified above
- The only errors between client & daemon that need captured are (1) auth errors, and (2) errors in uploading the file to the daemon.

For client-side error handling, see [Shared Client Requirements - Error Handling](./shared-client-requirements.md#error-handling).

### Notes

- AzuraCast allows testing via a staging server. Use the production/test :station_id (2).
- Supports robust metadata and playlist management.

---

## Mixcloud

### API documentation

- `https://www.mixcloud.com/DeVelopers/`.

### Authentication

- OAuth2-based authentication.
- Access tokens are stored per user.

### Upload

- Uploads are performed via `https://api.mixcloud.com/upload/`.
- Requires multipart form data with audio and metadata.

### Metadata

- Title, description, tags (used by this app to indicate genre), and tracklist are supported.
- Tracklist is supported, and the application / project here intends to supply a Tracklist.
- Set the field hosts-X-username to the DJ name
- Set field publish_date to the same as the set broadcast date & time
- **Artwork is required** and must be uploaded as part of the submission
- **Tags must include the genre** from the approved list (see songlists.md)

### Error Handling Considerations

#### Question 1: Content Length Validation
How should we handle Mixcloud's minimum content length requirement (15 minutes minimum for music)?

#### Decision 1:
Don't need to handle this. All uploads will be minimum 1 hour in practice. This is validated at the client level. See [Shared Client Requirements - File Validation](./shared-client-requirements.md#file-validation).

#### Question 2: Artwork Requirement
How should we handle the case where artwork is missing but required by Mixcloud?

#### Decision 2:
We'll require it at the client side, so the daemon does not need to handle this error. See [Shared Client Requirements - Artwork Requirements](./shared-client-requirements.md#artwork-requirements).

#### Question 3: Host Username Validation
How should we handle invalid host usernames or those who haven't accepted association invitations?

#### Decision 3:
I'll handle this in workflow outside the application. However, I believe host users can still be indicated in the post to Mixcloud; it just won't have effect at their end until the user accepts the association invitation. So, if there's an error, just log it to the daemon error file.

#### Question 4: Publish Date Timezone Issues
How should we handle timezone conversion for publish dates (must be in UTC)?

#### Decision 4:
This will be handled at the client and daemon level. See [Shared Client Requirements - Timezone Handling](./shared-client-requirements.md#timezone-handling).

The client will collect all date/time information in Central European Time, but will convert to UTC when creating the JSON "master" songfile document. The daemon will then convert the UTC timestamps back to Central European Time when sending to each destination:

- AzuraCast: Use Central European Time for setting Playlist date/time. (Also, we want to set Podcast info, too!)
- Mixcloud: Convert to UTC, but set the publication date/time as-if it were CET. In other words, set the publication date/time to the UTC equivalent of the CET date.
- SoundCloud: Same as Mixcloud - convert to UTC while preserving the CET time display.

#### Question 5: Content Fingerprinting
How should we handle rejection due to Mixcloud's audio fingerprinting detecting copyrighted material?

#### Decision 5:
Log it to the daemon error file.

#### Question 6: Default Values
Should we provide sensible defaults for optional fields that are technically required in practice?

#### Decision 6:
We'll always obtain a complete set of field information from the client before sending to the daemon, so the daemon will have all it needs. See [Shared Client Requirements - Metadata Validation](./shared-client-requirements.md#metadata-validation).

#### Question 7: Validation Before Upload
Should we implement client-side validation to catch issues before attempting uploads?

#### Decision 7:
Yes; we'll do validation on the client side so that whatever is received in the songfile by the daemon should be considered validated. See [Shared Client Requirements - Metadata Validation](./shared-client-requirements.md#metadata-validation) and [File Validation](./shared-client-requirements.md#file-validation).

### Notes

- No test environment; uploads are live.
- Rate limits apply.

---

## SoundCloud

### API documentation

- `https://developers.soundcloud.com/docs#uploading`
- `https://developers.soundcloud.com/docs/api/explorer/open-api`

### Authentication

- OAuth2-based authentication.
- Access tokens are stored per user.

### Upload

- SoundCloud requires a two-step process:
  1. First, upload the audio file via `https://api.soundcloud.com/tracks` (POST)
  2. Then, update the track metadata via `https://api.soundcloud.com/tracks/{track_id}` (PUT)
- Both steps require proper authentication.
- The first step returns a track ID that must be used in the second step.

### Metadata

- Title, genre, description, and sharing settings.
- **Artwork is required** and must be uploaded as part of the submission.
- **Genre must be from the approved list** (see songlists.md).
- Tracklist is not natively supported in the API, but can be included in the description.
- Sharing settings will be set to 'public'
- Additional fields supported: tags, purchase_url, license, release_date, isrc, bpm.

### Error Handling Considerations

#### Question 1: Two-Step Process Atomicity
How should we handle the case where the first step of SoundCloud's upload process succeeds but the second fails?

#### Decision 1:
Log to the daemon error log, and indicate a general Soundcloud update to the user / client.

#### Question 2: Partial Upload Cleanup
How should we handle cleanup of partial uploads, especially for SoundCloud's two-step process?

#### Decision 2:
Log to the daemon error log, and indicate a general Soundcloud update to the user / client. *If* we can, we should probably delete the uploaded file.

#### Question 3: Upload Quota Enforcement
How should we handle SoundCloud's upload quota exceeded errors?

#### Decision 3:
Log to the daemon error log and be specific, and indicate a general Soundcloud update to the user / client.

#### Question 4: Artwork Format Requirements
How should we handle artwork that doesn't meet SoundCloud's specific requirements for dimensions and file formats?

#### Decision 4:
We will enforce artwork requirements on the client side. See [Shared Client Requirements - Artwork Requirements](./shared-client-requirements.md#artwork-requirements).

#### Question 5: Transcoding Failures
How should we handle SoundCloud's server-side transcoding failures that can occur after successful upload?

#### Decision 5:
Do not handle this error; we will handle it off-app.

#### Question 6: Platform Prioritization
If SoundCloud upload fails but other platforms succeed, should we consider the overall upload successful or failed?

#### Decision 6:
The daemon will write success & error logs; if any service upload fails, that value should be returned to the client. 

How this is handled depends on the user's role:
- For DJ users: The upload is considered successful once it reaches the daemon. DJ users don't wait for or see destination results.
- For Admin users: The client will display detailed status for each destination, showing which succeeded and which failed.

See [Shared Client Requirements - Error Handling](./shared-client-requirements.md#error-handling) and [User Roles](./shared-client-requirements.md#user-roles) for more details.

#### Question 7: Scheduled Retry Mechanism
Should we implement a background job system to automatically retry failed uploads after a delay?

#### Decision 7:
No. The uploads to destinations should be sone synchronously (Await), with an increasing backoff, and abandon with an error after 3 attempts.

### Notes

- No test environment; uploads are live.
- Rate limits and content policies apply.

---

## Testing Strategy

- AzuraCast: Use the dev/test server for integration tests. However, implement mocks & stubs for initial development prior to testing against that server.
- Mixcloud/SoundCloud: Use mocks and stubs to simulate uploads.
- Validate metadata formatting and API request structure in tests.

## Cross-Platform Error Handling Considerations

#### Question 1: Error Recovery Strategy
Should we implement a unified error recovery strategy across all platforms or handle each platform differently?

#### Decision 1:
We will implement a unified error recovery strategy across all platforms. This includes:
- Automatic retries (up to 3 times) with backoff for network failures
- No retries for validation errors
- Detailed error logging for all platforms using the same format
- Consistent error reporting back to clients

#### Question 2: User Notification Detail
What level of error detail should be exposed to users vs. administrators across all platforms?

#### Decision 2:
The level of error detail depends on the user's role:

- DJ Role:
  - DJ users only see basic error information about their upload to the daemon
  - DJ users don't see information about multiple destinations
  - For DJ users, the upload is considered complete once the file is successfully uploaded to the daemon

- Admin Role:
  - Admin users see detailed error information for all destinations
  - Admin users can see which specific service had an error
  - Admin users have retry options for failed uploads to specific destinations

See [Shared Client Requirements - Error Handling](./shared-client-requirements.md#error-handling) and [User Roles](./shared-client-requirements.md#user-roles) for client-side implementation.

#### Question 3: Validation Before Upload
Should we implement a consistent client-side validation approach across all platforms?

#### Decision 3:
Yes, we will implement consistent client-side validation for all platforms. The clients will validate all required fields, file formats, and metadata before submission to the daemon. See [Shared Client Requirements - File Validation](./shared-client-requirements.md#file-validation) and [Metadata Validation](./shared-client-requirements.md#metadata-validation).

#### Question 4: Platform Prioritization
If one platform fails but others succeed, should we consider the overall upload successful or failed?

#### Decision 4:
Each platform upload is treated independently. The daemon will report success/failure for each platform separately.

How this is handled depends on the user's role:
- For DJ users: The upload is considered successful once it reaches the daemon, regardless of destination results.
- For Admin users: The client will display the status of each platform upload individually, while also providing an overall status that indicates if any uploads failed.

See [Shared Client Requirements - Error Handling](./shared-client-requirements.md#error-handling) and [Upload Flow](./shared-client-requirements.md#upload-flow) for more details.

#### Question 5: Scheduled Retry Mechanism
Should we implement a background job system to automatically retry failed uploads after a delay for all platforms?

#### Decision 5:
No. For all platforms, uploads to destinations will be done synchronously (Await), with an increasing backoff, and abandon with an error after 3 attempts. We will not implement a background job system for scheduled retries.
