# Upload Distributor TODO List

## Architecture Improvements

- **Refactor Project Structure**: Move the songlist-parser package into the daemon package since it's only used by the daemon. This would simplify imports and reduce ESM/TypeScript issues.
  - Current location: `packages/songlist-parser/`
  - Target location: `packages/daemon/src/songlist-parser/`

## Bug Fixes

- **Fix React StrictMode Double Execution**: The daemon is processing uploads twice because React's StrictMode is causing components to render twice in development mode. This is causing the upload form to be submitted twice, resulting in two separate file uploads with different UUIDs.
  - Add useRef guards in the React components to prevent duplicate form submissions
  - Alternatively, disable StrictMode during development when testing file uploads

- **Fix Songlist File Extension Handling**: In file-processor.ts, there's an issue with how the songlist file path is constructed. It's using the artwork filename extension but replacing '.jpg' with '.rtf', which is causing it to look for an '.rtf' file when an '.m3u8' file was uploaded.
  ```typescript
  // Current problematic code:
  const songlistExt = metadata.artworkFilename ? path.extname(metadata.artworkFilename).replace('.jpg', '.rtf') : '.rtf';
  let songlistFile = path.join(fileDir, `${normalizedBase}${songlistExt}`);
  ```
  - Update this code to properly handle all supported file extensions

- **Fix ts-node ESM Module Issues**: When running the daemon with `npm run dev` (using ts-node), there are issues with ESM module imports. The current workaround is to build the packages first and run the compiled JavaScript files with `npm run start`.

## Feature Enhancements

- **Implement explicit choice of Genre fields**: The Genre choices need to be limiited to an explicit list, selected during upload:
  - Add list with multiple choices to web-ui
  - Other as needed

- **Implement Multi-Stage Upload with Progress for Large MP3 Files**: The current upload process sends all files (MP3, songlist, artwork) in a single request, which is problematic for large MP3 files (60-120MB). Implement a multi-stage upload process:
  - Stage 1: Upload metadata, songlist file, and artwork only
  - Stage 2: Parse and validate the songlist (allowing title/artist swapping)
  - Stage 3: Upload the large MP3 file with progress tracking
  - Implementation considerations:
    - Add a new endpoint for MP3-only uploads that accepts a fileId parameter to associate with existing metadata
    - Implement chunked uploads or use a library like tus.io for resumable uploads
    - Add progress event listeners in the web UI to show real-time upload progress
    - Update the file-processor to handle files that arrive in multiple stages
    - Ensure the UI prevents users from leaving the page during uploads
    - Add support for pausing/resuming large file uploads

- **Improve Error Handling**: Add more detailed error messages and logging to help diagnose issues like the "Songlist file not found" error.

- **Add File Extension Validation**: Ensure the daemon correctly handles all supported file extensions and doesn't try to look for files with extensions that weren't uploaded (e.g., looking for .rtf when .m3u8 was uploaded).

- **Enhance Client-Side File Validation**: While basic file extension validation exists, implement more comprehensive client-side validation:
  - Validate MP3 file content type using the File API (not just extension)
  - Implement image dimension validation for artwork (ensure it's 1440x1440px only)
  - Add real-time feedback during validation

## Documentation

- **Update Debugging Notes**: Keep the debugging notes up to date with any new issues and solutions discovered.

- **Document Common Issues**: Create a troubleshooting guide for common issues encountered during development.
