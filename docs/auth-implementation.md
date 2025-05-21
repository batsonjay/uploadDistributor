# Authentication Implementation

*Plan updated on 2025/05/18*

This document outlines the implementation of the authentication system for the Upload Distributor project, including user roles, authentication flows, and integration with the upload process.

## Current Authentication Plan

Because the AzuraCast API doesn't provide an authentication service for users on a station server. Yet, the Upload Distributor project needs a way to do something akin to authentication. The project doesn't do any financial features or implications, contain personal information or have other attributes requiring super-strict authentication. All it needs to do is to provide a fairly modest way to prevent people who aren't registered as an AzuraCast user from using the Upload Distributor user interface. It also needs to provide for a super-administrator to have the ability to perform tasks on behalf of other users, impersonating / assuming their identity for a short time.

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

This section outlines how existing components will be affected by the new email-based authentication plan.

### AuthService Module (packages/daemon/src/services/AuthService.ts)

**What's retained:**
- The basic structure of the AuthService class
- User role constants and types
- The singleton pattern for the service
- Methods for validating tokens
- Integration with AzuraCast API for user verification
- Directory verification for DJs

**What changes:**
- The `authenticate` method would be replaced with an email-based authentication flow
- We'd add methods to generate and validate one-time login links/tokens
- The token validation would now check against expiration timestamps rather than creation timestamps
- We'd remove password-related logic since we're moving to passwordless authentication

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
- The `/login` route would be replaced with:
  - An `/auth/request-login` endpoint that accepts an email and sends a magic link
  - An `/auth/verify-login` endpoint that validates the magic link token
- We'd remove password-related logic and validation
- We'd add logic to set different expiration times based on user role

### Other Components Affected

**PasswordUtils.ts:**
- This would eventually be deprecated as we move away from password-based authentication
- During transition, it could be kept for backward compatibility

**AzuraCastApi.ts:**
- Would be enhanced to support email verification
- Would still be used to verify user existence and roles
- The directory verification functionality would remain unchanged

**roleVerification.ts middleware:**
- Would remain largely unchanged
- Still needed to protect routes based on user roles

**AuthContext.tsx (web-ui):**
- Would be significantly updated to support the email-based flow
- Would implement the role-based token expiration logic
- Would add UI for the email input and verification process

### New Components Needed

1. **EmailService:**
   - A new service to handle sending magic link emails
   - Would need to generate secure, time-limited tokens
   - Would format and send emails with login links

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

- The authentication system is transitioning from password-based to email-based authentication
- Role-based access control is fully implemented and will be maintained
- The upload processor uses a service-based architecture that will continue to be used
- The two-tier logging system is implemented and will remain unchanged
- Integration with AzuraCast API is in place and will be enhanced for email verification

### Implementation Phases

The implementation of the new authentication system will be done in phases to allow for incremental development and testing:

#### Phase 1: Email-Based Authentication Core
- Create the EmailService for generating and sending magic links
- Add endpoints for requesting login links and verifying tokens
- Update AuthContext.tsx to support the email-based login flow
- Implement basic email verification without role-based expiration
- Set up Google as the outgoing Gmail SMTP service (needs done by the developer outside this coding effort)
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
- Create user guides for the new authentication flow
- Perform final security review

For more detailed information about the token expiration implementation, see [Token Expiration Documentation](./auth-token-expiration.md).

For testing instructions, see [Testing Token Expiration](./testing-token-expiration.md).

## Phase 1 Implementation Details

This section provides detailed implementation specifics for Phase 1 of the authentication system.

### Token Generation

Since the application doesn't require high-security cryptographic tokens, we'll use a simpler approach for generating magic link tokens:

```typescript
private generateToken(): string {
  // Generate a random string using Math.random and current timestamp
  const randomPart = Math.random().toString(36).substring(2, 15);
  const timestampPart = Date.now().toString(36);
  
  // Combine with a unique identifier
  return `${randomPart}${timestampPart}`;
}
```

This approach:
- Uses JavaScript's built-in `Math.random()` combined with the current timestamp
- Converts to base36 (alphanumeric) for readability
- Is sufficiently random for our non-critical security needs
- Requires no additional libraries

### Email Implementation

We'll use nodemailer with Google's SMTP server to send magic link emails:

```typescript
// In EmailService.ts
import nodemailer from 'nodemailer';

// Create reusable transporter
private createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'balearicfm@gmail.com',
      pass: process.env.EMAIL_PASSWORD // App password after 2FA is enabled
    }
  });
}

// Send the magic link email
public async sendMagicLinkEmail(email: string): Promise<boolean> {
  try {
    const { token, url } = this.createMagicLink(email);
    
    const transporter = this.createTransporter();
    
    const info = await transporter.sendMail({
      from: '"Upload Distributor" <balearicfm@gmail.com>',
      to: email,
      subject: "Your Login Link for Upload Distributor",
      text: `Hello,\n\nClick the link below to log in to Upload Distributor:\n\n${url}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this link, you can safely ignore this email.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Upload Distributor Login</h2>
          <p>Hello,</p>
          <p><a href="${url}">Click to proceed with uploading the files & scheduling your set</a></p>
          <p>Or copy and paste this link in your browser:</p>
          <p style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
            ${url}
          </p>
          <p>This link will expire in 15 minutes.</p>
          <p>If you didn't request this link, you can safely ignore this email.</p>
        </div>
      `
    });
    
    console.log("Email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Error sending email:", error);
    return false;
  }
}
```

Key points:
- Uses Gmail SMTP server with the balearicfm@gmail.com account
- Requires 2FA to be enabled on the Gmail account and an app password to be generated
- Sends both plain text and HTML versions of the email
- Uses a simple hyperlink with descriptive text instead of a styled button
- Includes a fallback with the full URL for copying and pasting

### Error Handling

We'll use clear, descriptive error messages for common issues:

```typescript
// In AuthService.ts when checking if user exists
if (!user) {
  return { 
    success: false, 
    message: "No such email address found. Please check your spelling or contact your station administrator." 
  };
}

// In EmailService.ts when sending fails
if (!emailSent) {
  return {
    success: false,
    message: "Failed to send login email. Please try again or contact your administrator."
  };
}
```

These messages:
- Clearly state what went wrong
- Provide suggestions for how to resolve the issue
- Include an escalation path if needed

### Implementation Notes

1. **Environment Variables**:
   - `EMAIL_USER`: The Gmail address (balearicfm@gmail.com)
   - `EMAIL_PASSWORD`: App password generated after enabling 2FA
   - These should be stored in `.env` files and not committed to the repository

2. **Dependencies**:
   - `nodemailer`: For sending emails (`npm install nodemailer`)
   - `@types/nodemailer`: TypeScript types (`npm install --save-dev @types/nodemailer`)

3. **Testing Considerations**:
   - 2FA must be enabled on the Gmail account before testing
   - An app password must be generated and stored in the environment variables
   - Initial testing can be done with a developer's email address

### Middleware Update for localStorage

To align the middleware with the localStorage-based authentication approach, we'll need to update how the authentication token is passed to the server:

```typescript
// In AuthContext.tsx - Add function to attach token to requests
// This would be used in a custom fetch wrapper or axios interceptor
const attachTokenToRequest = (config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    // For fetch API
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return config;
};

// In middleware.ts - Update to check for Authorization header instead of cookies
export function middleware(request: NextRequest) {
  // Get the pathname
  const { pathname } = request.nextUrl;

  // Check if it's a public route
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check for auth token in Authorization header instead of cookies
  const authHeader = request.headers.get('Authorization');
  const token = authHeader ? authHeader.replace('Bearer ', '') : null;

  // If no token and not a public route, redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
```

This approach:
- Uses the Authorization header to pass the token from localStorage to the server
- Maintains the existing middleware structure and route protection
- Works with the localStorage-based token expiration mechanism
- Requires client-side code to attach the token to all requests

For API requests, we'll need to ensure the token is attached to all fetch/axios calls:

```typescript
// Example of a fetch wrapper that attaches the token
const authenticatedFetch = async (url, options = {}) => {
  const token = localStorage.getItem('authToken');
  
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
};
```

For page navigation and initial page loads, we'll need to implement a solution that ensures the token is available to the middleware. This could involve:

1. Using a client-side script that runs on each page load to set a cookie based on localStorage
2. Using Next.js's App Router layout components to handle authentication state
3. Implementing a custom document or app component that manages the token synchronization
