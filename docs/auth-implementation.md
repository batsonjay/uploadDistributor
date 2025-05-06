# Authentication Implementation

This document outlines the implementation of the authentication system for the Upload Distributor project, including user roles, authentication flows, and integration with the upload process.

## User Information

- Admin User:
  - Email: batsonjay@mac.com
  - Display Name: catalyst
  - Role: Super Administrator

- DJ User:
  - Email: miker@mrobs.co.uk
  - Display Name: Chewee
  - Role: DJ

## Testing Strategy

The implementation was tested at two key points:

1. **First Testing Point: After Step 3 (Creating Authentication Routes)**
   - At this point, we had a functional authentication system with API endpoints
   - We tested user login, token validation, and profile retrieval
   - This allowed us to verify the authentication system before integrating it with the upload process

2. **Second Testing Point: After Step 5 (Updating Upload Processor)**
   - This is when the role-based flow was fully integrated
   - We tested the complete authentication and upload process
   - We verified that different user roles (Admin vs DJ) follow the appropriate workflows
   - This comprehensive test ensured all components work together correctly

## Implementation Steps

### Step 1: Create AuthService Module

Created the AuthService.ts file with:
- User role constants (ADMIN, DJ)
- User profile and authentication response interfaces
- Mock user data for testing
- Authentication methods for login and token validation
- Placeholder methods for future AzuraCast API integration

### Step 2: Enhance AzuraCastApiMock

Updated AzuraCastApiMock.ts to:
- Use the AuthService for authentication
- Add methods for user authentication, token validation, and profile retrieval
- Record authentication-related API requests for testing and debugging

### Step 3: Create Authentication Routes

Created the auth.ts file in the routes directory with:
- Login route that accepts email and password
- Token validation route to verify authentication tokens
- Profile route to retrieve user information
- Error handling for all routes
- Updated the main index.ts file to use these routes

### Step 4: Update SonglistStorage for User Roles

Updated the SonglistStorage.ts file to:
- Import user role types from AuthService
- Extend the SonglistData interface to include user_role and destinations fields
- Update the parseSonglist function to handle the new fields with default values

### Step 5: Update Upload Processor for Role-Based Flows

Updated the upload-processor.ts file to:
- Get user role from metadata or songlist
- Implement different processing flows for DJ and Admin users
- Return success immediately for DJ users after storing the songlist
- Continue processing in the background for DJ users
- Only update final status for Admin users
- Respect selected destinations from the songlist
- Upload to selected platforms sequentially with platform-specific recovery logic

### Step 6: Implement Timezone Conversion

Created TimezoneUtils.ts with:
- utcToCet function to convert UTC timestamps to Central European Time
- cetToUtc function to convert CET/CEST timestamps to UTC
- Updated upload-processor.ts to use these conversions for destination metadata

### Step 7: Implement Two-Tier Logging System

Created LoggingUtils.ts with:
- Log types (SUCCESS, ERROR) and error types (AUTHENTICATION, VALIDATION, etc.)
- logDestinationStatus function for high-level success/error logging
- logDetailedError function for detailed error information
- Configured log file paths and ensured log directory exists

### Step 8: Refactor upload-processor.ts

Created StatusManager service:
- Handles status updates and logging for upload processes
- Provides a centralized way to update status files and log events
- Includes methods for updating status, logging success, and logging errors

Created destination-specific services:
- AzuraCastService.ts for AzuraCast uploads
- MixcloudService.ts for Mixcloud uploads
- SoundCloudService.ts for SoundCloud uploads
- Each service handles platform-specific upload logic and error recovery

### Step 9: Update SoundCloudService to use two-step process

Implemented the two-step upload process in SoundCloudService:
- Step 1: Upload the file with initial metadata
- Step 2: Update the metadata after successful upload
- Added recovery logic for quota/permission issues
- Implemented fallback to private uploads when needed
- Added detailed logging for both steps

### Step 10: Implement Password Obfuscation with XOR

Implemented password obfuscation with XOR to avoid plaintext passwords:

1. Created PasswordUtils.ts with:
   - encodePassword function that uses XOR with a fixed key and base64 encoding
   - decodePassword function that reverses the process
   - Proper error handling for edge cases

2. Updated AuthService.ts to:
   - Accept encoded passwords instead of plaintext
   - Decode passwords before authentication
   - Update method signatures for authenticateWithAzuraCast

3. Updated auth.ts routes to:
   - Accept both encoded and plaintext passwords for backward compatibility
   - Encode plaintext passwords on the server side if needed
   - Update error messages and validation

4. Updated AzuraCastApiMock.ts to:
   - Support encoded passwords in authenticateWithCredentials
   - Handle both password formats for backward compatibility
   - Properly record authentication requests with redacted passwords

5. Created test-password-utils.ts to verify:
   - Encoding and decoding works for various password types
   - The login flow works correctly with encoded passwords
   - All tests pass successfully

### Step 11: Fix StatusManager Path Resolution

Fixed the StatusManager.ts path resolution:
- Added robust path detection for both ts-node and compiled JavaScript environments
- Implemented directory structure detection to find the correct uploads directory
- Added logging to show which uploads directory is being used
- Added a delay before exiting to ensure status files are fully written
- Enhanced the test script with proper user role and delay handling

## Current Status

- The authentication system is fully implemented with role-based access control
- Password obfuscation is implemented to avoid plaintext passwords
- The upload processor has been refactored into service-based architecture
- Two-tier logging system is implemented
- SoundCloud two-step upload process is working correctly
- The project has a solid foundation for further development

## Next Steps

- Integrate the authentication system with the real AzuraCast API
- This would involve updating the AuthService to use the real API endpoints instead of mock data
- Begin replacing other mocks with actual API integrations
- Start work on Web Client Development with role-based UI
