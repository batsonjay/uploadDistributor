# Authentication Implementation

*Plan updated on 2025/05/18*

This document outlines the implementation of the authentication system for the Upload Distributor project, including user roles, authentication flows, and integration with the upload process.

## Current Authentication Plan

The AzuraCast API doesn't provide an authentication service for users on a station server, yet the Upload Distributor project needs a way to do something akin to authentication. The project doesn't have any financial features or implications, contain personal information or have other attributes requiring super-strict authentication. All it needs to do is to provide a fairly modest way to prevent people who aren't registered as an AzuraCast user from using the Upload Distributor user interface. It also needs to provide for a super-administrator to have the ability to perform tasks on behalf of other users, impersonating / assuming their identity for a short time.

So an adequate authentication system can be implemented with the following elements:

### Email-Based Authentication

1. **Authentication Flow**:
   - Users enter their email address on the login screen
   - System sends a magic link to their email
   - User clicks the link to authenticate
   - System verifies the email and retrieves user information from AzuraCast
   - User becomes effectively logged in with appropriate role and permissions

2. **Role-Based Token Expiration**:
   - DJ tokens expire after 24 hours
   - Super Admin tokens expire after 10 years
   - Expiration time is stored directly in localStorage as a timestamp
   - No need for server-side verification of expiration

3. **DJ Selection for Super Admins**:
   - Super admins see a DJ selector on the upload page
   - They can select any DJ (including their own DJ account) to upload as
   - The selection applies only to the current upload
   - Files are named and stored using the selected DJ's name

4. **Session Persistence**:
   - Sessions persist across browser restarts and tab closures
   - Super admins effectively remain logged in until they explicitly log out or clear browser data due to the far-future token expiration
   - DJs are automatically logged out after 24 hours (via token expiration)
   - When a token expires, the user is automatically redirected to the login page

5. **Security Considerations**:
   - No sensitive role information is stored directly in localStorage
   - Only the expiration timestamp is stored, calculated based on the user's role
   - The authentication system relies on email verification rather than passwords
   - The super admin API key remains securely stored on the server

This updated plan replaces the previous password-based authentication with this email-based approach, while maintaining appropriate security measures for the application's needs.

## Component Changes in New Authentication Plan

This section outlines how components will implemnet the new email-based authentication plan.

### AuthService Module (packages/daemon/src/services/AuthService.ts)

**What's retained:**
- The basic structure of the AuthService class
- User role constants and types
- The singleton pattern for the service
- Methods for validating tokens
- Integration with AzuraCast API for user verification
- Directory verification for DJs

**What changes from prior code:**
- The `authenticate` method is replaced with an email-based authentication flow
- Add methods to generate and validate one-time login links/tokens
- Token validation would now check against expiration timestamps rather than creation timestamps
- Remove password-related logic and move to passwordless authentication

### AzuraCastApiMock.ts (packages/daemon/src/mocks/AzuraCastApiMock.ts)

**Status:** This will eventually become obsolete, but should be kept during transition.

**Reasoning:**
- The mock was primarily used for testing and development without requiring a real AzuraCast instance
- With the real AzuraCast API integration already implemented, we're moving away from mocks
- However, it's valuable to keep during development and testing of the new authentication flow
- Once the email-based authentication is fully implemented and tested, we can deprecate this file

### auth.ts Routes (packages/daemon/src/routes/auth.ts)

**What's retained:**
- The basic route structure
- Token validation endpoint
- User profile retrieval endpoint
- Role-based access control

**What changes:**
- The `/login` route replaced with:
  - An `/auth/request-login` endpoint that accepts an email and sends a magic link
  - An `/auth/verify-login` endpoint that validates the magic link token
- Remove password-related logic and validation
- Add logic to set different expiration times based on user role

### Other Components Affected

**PasswordUtils.ts:**
- This will eventually be deprecated as we move away from password-based authentication
- During transition, it is kept for backward compatibility

**AzuraCastApi.ts:**
- Enhanced to support email verification
- Used to verify user existence and roles
- Directory verification functionality remains unchanged

**roleVerification.ts middleware:**
- Remains largely unchanged
- Protects routes based on user roles

**AuthContext.tsx (web-ui):**
- Significantly updated to support the email-based flow
- Implements the role-based token expiration logic
- Adds UI for the email input and verification process

### New Components Needed

1. **EmailService:**
   - A new service to handle sending magic link emails
   - Generates secure, time-limited tokens
   - Formats and sends emails with login links

2. **DJ Selector Component:**
   - A new UI component for the upload page
   - Only visible to Super Admin users
   - Fetches and displays the list of DJs for selection

3. **Token Management:**
   - Logic to generate secure one-time tokens for magic links
   - Storage mechanism for pending login requests

## Relevant information from previous implementation

The following information from the previous implementation remains relevant to the new authentication plan or provides important context for existing code.

## User Information for Development/Testing

- Admin User:
  - Email: batsonjay@gmail.com
  - Display Name: Jay Batson
  - Role: Super Administrator

- DJ User:
  - Email: batsonjay@mac.com
  - Display Name: catalyst
  - Role: DJ

## Key Components Still Relevant

### Role-Based Access Control

The role-based access control system remains a critical part of the authentication system:

- **Role Verification Middleware**: The middleware functions that verify user roles before allowing access to protected routes will continue to be used.
  - `verifyRole(requiredRoles)`: A function that returns an Express middleware to check if the user has one of the required roles
  - `adminOnly`: A convenience middleware that only allows users with the Admin role
  - `anyAuthenticated`: A convenience middleware that allows any authenticated user (Admin or DJ)

- **Protected Routes**: The following routes will remain protected with role-based access control:
  - `/upload`: Requires authentication (Admin or DJ role)
  - `/status/:uploadId`: Requires authentication (Admin or DJ role)

### AzuraCast API Integration

The integration with the AzuraCast API remains largely unchanged:

- **Single API Key Approach**: We continue to use a single super administrator API key for all API operations
- **User Verification Process**: We still use the super admin API key to find and verify users in the AzuraCast system
- **Directory Verification**: The system will continue to verify that DJs have valid directories in AzuraCast before allowing uploads

### Directory Verification Process

The directory verification process remains an important security feature:

- After authenticating a user, we check if a directory exists for their display name in AzuraCast
- We use the `GET /api/station/{station_id}/files/directories` endpoint to list all directories
- We check if any directory's name matches the user's display name
- If no matching directory is found, we prevent uploads and provide appropriate error messages

### Upload Processing

The role-based upload processing flow remains relevant:

- Different processing flows for DJ and Admin users
- Role-specific behavior for upload status updates and background processing
- Destination-specific services for handling uploads to different platforms

## Current Status and Next Steps

### Current Status

- The authentication system has transitioned from password-based to email-based authentication
- Role-based access control is fully implemented and maintained
- The upload processor uses a service-based architecture that will continue to be used
- The generalized logging system is used to set logging levels based on need
- Integration with AzuraCast API is in place and will be enhanced for email verification

### Implementation Phases

The implementation of the new authentication system is done in phases to allow for incremental development and testing:

#### Phase 1: Email-Based Authentication Core
- Create the EmailService for generating and sending magic links
- Add endpoints for requesting login links and verifying tokens
- Update AuthContext.tsx to support the email-based login flow
- Implement basic email verification without role-based expiration
- Set up Google as the outgoing Gmail SMTP service (needs done by the developer outside this coding effort; likely remains incomplete until later in development to simplify the developer workflow)
- Update middleware to work with localStorage instead of cookies:
  1. Update the middleware.ts file to use a client-side approach that's compatible with localStorage
  2. Since Next.js middleware runs on the server and can't directly access localStorage, implement a solution where:
     - The token from localStorage is attached to requests as an Authorization header
     - The middleware checks for this header instead of cookies
- Test the core authentication flow end-to-end

#### Phase 2: DJ Selector for Super Admins
- Create API endpoint to fetch the list of DJs
- Implement the DJ selector component on the upload page
- Add logic to use the selected DJ's name for file naming
- Test the DJ impersonation functionality

#### Phase 3: Role-Based Token Expiration
- Update token generation to include role-based expiration times
- Modify the client-side expiration checks
- Implement the periodic expiration verification
- Test different expiration behaviors for DJ vs. Super Admin users

#### Phase 4: Cleanup and Documentation
- Begin phasing out password-related components
- Update all authentication documentation

For more detailed information about the token expiration implementation, see [Token Expiration Documentation](./auth-token-expiration.md).

For testing instructions, see [Testing Token Expiration](./testing-token-expiration.md).

## Phase 1 Implementation Summary

Phase 1 of the authentication system has been implemented with the following key components:

- **Token Generation**: Using crypto.randomBytes for secure token generation
- **Email Service**: Created EmailService with nodemailer integration (currently outputs magic links to console instead of sending emails)
- **JWT Authentication**: Implemented JWT token generation and validation
- **Role-Based Expiration**: Added different token expiration times based on user roles
- **Middleware Updates**: Updated to check for tokens in both Authorization headers and cookies
- **Client-Side Auth**: Created authenticatedFetch utility to properly handle API requests with authentication
- **Magic Link Flow**: Implemented request-login and verify-login endpoints with appropriate error handling

Note: Current implementation doesn't actually use SMTP email sending because the developer has not yet obtained an app password for this application. It works around this by printing the magic URL to the daemon command line, which the developer then visits independently (instead of receiving it in an email). Full email implementation has yet to be completed.

## Phase 2 Implementation Summary: DJ Selector for Super Admins

Phase 2 has been successfully implemented with the following key components:

### Backend Implementation

1. **API Endpoint for DJ List**: Added a `/djs` endpoint to the auth.ts routes file that:
   - Is protected by the adminOnly middleware
   - Fetches all users from AzuraCast
   - Filters to only include users with DJ role
   - Returns a formatted list of DJs with their IDs, emails, and display names

2. **AzuraCastApi Extensions**:
   - Added `getAllUsers()` method to fetch all users from AzuraCast
   - Added `getUserById()` method to retrieve a specific user by ID
   - Improved error handling and logging

3. **Upload Route**:
   - Created a new `upload.ts` route file that replaces the previous receive.ts functionality
   - Implemented DJ selection logic that allows admins to upload on behalf of DJs
   - Added validation to ensure only admins can use this feature
   - Updated file naming to use the selected DJ's name
   - Added metadata tracking to record both the DJ and the admin who performed the upload

4. **AuthService Updates**:
   - Added `getUserById()` method to retrieve user information by ID
   - Made `mapAzuraCastRoleToUserRole()` public to support role checking
   - Improved logging and error handling

### Frontend Implementation

1. **DJ Selector Component**:
   - Created a new React component that fetches and displays the list of DJs
   - Implemented UI for selecting a DJ from a dropdown
   - Added loading and error states
   - Included clear visual indication of which DJ is selected
   - Optimized to prevent unnecessary API calls

2. **Upload Page Integration**:
   - Updated the upload page to include the DJ selector for admin users
   - Modified the form submission to include the selected DJ's ID
   - Changed the API endpoint from `/receive` to `/upload`
   - Added visual feedback about the selected DJ

3. **Styling**:
   - Created a dedicated CSS module for the DJ selector component
   - Implemented responsive design for various screen sizes
   - Added visual distinction to make the DJ selection prominent

### Security Measures

- Implemented strict role-based access control for the DJ list endpoint
- Added validation to ensure only admins can upload on behalf of DJs
- Included comprehensive logging of all admin actions
- Maintained clear UI separation between regular uploads and admin-as-DJ uploads
- Ensured the selected DJ is only used for the current upload session

## Phase 3 Implementation Summary: Role-Based Token Expiration

Phase 3 has been successfully implemented with the following components:

- **Token Generation**: Updated to include role-based expiration times (24 hours for DJs, 10 years for admins)
- **Client-Side Verification**: Implemented expiration checks in the AuthContext component
- **Automatic Logout**: Added logic to redirect to login page when tokens expire
- **Persistence**: Configured localStorage to store tokens and expiration times
- **Security**: Ensured token validation includes expiration checks on both client and server

## Phase 4: Remaining Tasks

While Phases 1-3 have been fully implemented, the following tasks remain for Phase 4:

1. **Documentation Updates**:
   - Update API documentation to reflect the new endpoints and parameters

2. **Password Cleanup**:
   - Remove any remaining password-based authentication code
   - Fully deprecate the PasswordUtils.ts file once all references are removed
   - Remove test files, as most tests are now performed interactively

3. **Email Integration**:
   - Complete the integration with a production email service
   - Implement proper email templates for magic links
   - Add configuration options for email settings
   - Test email delivery in various environments
