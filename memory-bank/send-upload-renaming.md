# Send/Upload Terminology Renaming Plan

This document outlines the plan for renaming terminology in the uploadDistributor project to clarify the distinction between:

1. Client/tests **sending** files TO the daemon (daemon **receiving** files)
2. Daemon **uploading** files TO endpoints (AzuraCast, Mixcloud, SoundCloud)

## Implementation Strategy

The implementation will be split into two steps to make the changes manageable and testable.

## Step 1: Core Daemon Changes

Focus on the daemon's receiving functionality and route changes:

### File Renames
1. `packages/daemon/src/routes/upload.ts` → `packages/daemon/src/routes/receive.ts`
2. Update `packages/daemon/src/index.ts` to reference the new route file

### Code Changes
1. In `receive.ts` (formerly `upload.ts`):
   - Update route comments and documentation
   - Change log messages from "upload" to "receive" terminology
   - Update status messages to use "received" instead of "uploaded"
   - Keep the actual API endpoint as `/upload` for now to minimize changes

2. In `upload-processor.ts`:
   - Update comments to clarify "receiving" vs "uploading" terminology
   - Keep "upload" terminology when referring to sending files to endpoints
   - Update variable names where appropriate

3. In `packages/daemon/src/services/StatusManager.ts`:
   - Ensure status messages use consistent terminology

### Test After Step 1
Run the existing tests to ensure the daemon still functions correctly:
```
cd packages/daemon && npm run test-upload
```

## Step 2: Shared Module and Test Changes + Documentation

Focus on the shared module, test files, and documentation:

### File Renames
1. `packages/shared/src/upload.ts` → `packages/shared/src/send.ts`
2. `packages/daemon/__tests__/upload.test.ts` → `packages/daemon/__tests__/send.test.ts`
3. `packages/daemon/__tests__/upload-with-shared.test.ts` → `packages/daemon/__tests__/send-with-shared.test.ts`

### Code Changes
1. In `packages/shared/src/send.ts` (formerly `upload.ts`):
   - Rename functions and interfaces:
     - `uploadFiles()` → `sendFiles()`
     - `UploadMetadata` → `SendMetadata`
     - `UploadFiles` → `SendFiles`
     - `UploadCallbacks` → `SendCallbacks`
     - `UploadOptions` → `SendOptions`
     - `UploadResult` → `SendResult`
   - Update comments and documentation

2. In `packages/shared/src/index.ts`:
   - Update the export to reference the new file name

3. In test files:
   - Update test scripts in `package.json` to reference the new test file names
   - Update test code to use "send" terminology when referring to client actions
   - Update expected status messages in tests

### Documentation Changes
1. Update API documentation in:
   - `docs/daemon-apis.md`
   - `docs/web-client.md`
   - `docs/macos-client.md`
   - `docs/shared-client-requirements.md`

2. Update implementation plan in:
   - `docs/Implementation-plan.md`

3. Update any other relevant documentation to use the new terminology consistently

### Test After Step 2
Run the renamed tests to ensure everything works correctly:
```
cd packages/daemon && npm run test-send
cd packages/daemon && npm run test-send-shared
```

## Considerations

1. We're keeping the name `upload-processor.ts` as it's general enough and describes its primary function of handling uploads to endpoints.

2. We're making a clean break without preserving backward compatibility since we're on a separate branch and there's minimal client code to worry about.

3. The changes are focused on clarifying terminology while maintaining the core functionality of the system.

4. If any issues arise during implementation, we can always revert to the main branch and start again.
