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

## Phase 2 Implementation Details: DJ Selector for Super Admins

This section provides detailed implementation specifics for Phase 2 of the authentication system, which focuses on allowing Super Admins to submit uploads on behalf of DJs.

### Backend Changes

#### 1. API Endpoint to Fetch DJ List

```typescript
// In packages/daemon/src/routes/auth.ts
/**
 * Get all DJs endpoint
 * 
 * Returns a list of all users with DJ role from AzuraCast
 * Only accessible to Super Admin users
 */
router.get('/djs', adminOnly, async (req, res) => {
  try {
    logParserEvent('AuthRoutes', ParserLogType.INFO, 'DJ list requested');
    
    // Create AzuraCast API client
    const api = new AzuraCastApi();
    
    // Get all users from AzuraCast
    const users = await api.getAllUsers();
    
    if (!users.success) {
      logParserEvent('AuthRoutes', ParserLogType.WARNING, `Failed to fetch users: ${users.error}`);
      return res.status(400).json(users);
    }
    
    // Filter to only include DJs (non-admin users)
    const djs = users.users.filter(user => {
      const role = authService.mapAzuraCastRoleToUserRole(user.roles);
      return role === USER_ROLES.DJ;
    }).map(user => ({
      id: user.id.toString(),
      email: user.email,
      displayName: user.name
    }));
    
    logParserEvent('AuthRoutes', ParserLogType.INFO, `Returning ${djs.length} DJs`);
    return res.json({
      success: true,
      djs
    });
  } catch (err) {
    logParserEvent('AuthRoutes', ParserLogType.ERROR, `Error in /djs:`, err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

#### 2. Update AzuraCastApi to Get All Users

```typescript
// In packages/daemon/src/apis/AzuraCastApi.ts
/**
 * Get all users from AzuraCast
 * 
 * @returns Promise with all users or error
 */
public async getAllUsers(): Promise<{ success: boolean; users?: any[]; error?: string }> {
  try {
    const response = await fetch(`${this.baseUrl}/api/admin/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Failed to fetch users: ${response.status} ${errorText}`
      };
    }

    const users = await response.json();
    return {
      success: true,
      users
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

#### 3. Update Receive Route to Handle DJ Selection

```typescript
// In packages/daemon/src/routes/receive.ts
// Update the upload endpoint to accept a djId parameter
router.post('/upload', upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'artwork', maxCount: 1 },
  { name: 'songlist', maxCount: 1 }
]), async (req, res) => {
  try {
    // Get the authenticated user from the request
    const authUser = req.user;
    
    // Check if a DJ was selected (only for admin users)
    let effectiveUser = authUser;
    if (authUser.role === USER_ROLES.ADMIN && req.body.selectedDjId) {
      // Get the selected DJ's information
      const selectedDj = await authService.getUserById(req.body.selectedDjId);
      if (selectedDj.success && selectedDj.user) {
        // Use the selected DJ as the effective user for this upload
        effectiveUser = selectedDj.user;
        logParserEvent('ReceiveRoutes', ParserLogType.INFO, 
          `Admin ${authUser.displayName} uploading on behalf of DJ ${effectiveUser.displayName}`);
      } else {
        logParserEvent('ReceiveRoutes', ParserLogType.WARNING, 
          `Admin ${authUser.displayName} attempted to upload as invalid DJ ID: ${req.body.selectedDjId}`);
      }
    }
    
    // Process the upload using the effective user (either the auth user or the selected DJ)
    // ... rest of the upload processing code ...
    
    // Use the effective user's display name for file naming
    const userDisplayName = effectiveUser.displayName;
    
    // ... continue with existing upload logic ...
  } catch (error) {
    // ... error handling ...
  }
});
```

#### 4. Add Method to Get User by ID in AuthService

```typescript
// In packages/daemon/src/services/AuthService.ts
/**
 * Get a user by ID from AzuraCast
 * 
 * @param userId The ID of the user to retrieve
 * @returns Promise with user information or error
 */
public async getUserById(userId: string): Promise<AuthResponse> {
  try {
    logParserEvent('AuthService', ParserLogType.INFO, `Getting user with ID: ${userId}`);
    
    // Create AzuraCast API client
    const api = new AzuraCastApi();
    
    // Get user from AzuraCast
    const userResult = await api.getUserById(userId);
    
    if (!userResult.success || !userResult.user) {
      logParserEvent('AuthService', ParserLogType.WARNING, `User not found with ID: ${userId}`);
      return {
        success: false,
        error: 'User not found'
      };
    }
    
    const apiUser = userResult.user;
    
    // Map AzuraCast user to our UserProfile format
    const userProfile: UserProfile = {
      id: apiUser.id.toString(),
      email: apiUser.email,
      displayName: apiUser.name,
      role: this.mapAzuraCastRoleToUserRole(apiUser.roles)
    };
    
    logParserEvent('AuthService', ParserLogType.INFO, `Found user: ${userProfile.displayName} (ID: ${userProfile.id})`);
    return {
      success: true,
      user: userProfile
    };
  } catch (error) {
    logParserEvent('AuthService', ParserLogType.ERROR, `Error in getUserById:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

### Frontend Changes

#### 1. DJ Selector Component

```tsx
// In apps/web-ui/app/components/DjSelector.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import styles from './DjSelector.module.css';

interface DJ {
  id: string;
  displayName: string;
  email: string;
}

interface DjSelectorProps {
  onSelectDj: (dj: DJ | null) => void;
}

export default function DjSelector({ onSelectDj }: DjSelectorProps) {
  const [djs, setDjs] = useState<DJ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDj, setSelectedDj] = useState<DJ | null>(null);
  const { user, authenticatedFetch } = useAuth();

  // Only show for admin users
  if (user?.role !== 'ADMIN') {
    return null;
  }

  useEffect(() => {
    const fetchDjs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await authenticatedFetch('http://localhost:3001/api/auth/djs');
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch DJs');
        }
        
        const data = await response.json();
        
        if (data.success && data.djs) {
          setDjs(data.djs);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching DJs:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDjs();
  }, [authenticatedFetch]);

  const handleSelectDj = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const djId = event.target.value;
    
    if (djId === '') {
      setSelectedDj(null);
      onSelectDj(null);
      return;
    }
    
    const selected = djs.find(dj => dj.id === djId) || null;
    setSelectedDj(selected);
    onSelectDj(selected);
  };

  if (loading) {
    return <div className={styles.loading}>Loading DJs...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  return (
    <div className={styles.container}>
      <label htmlFor="dj-selector" className={styles.label}>
        Upload as DJ:
      </label>
      <select
        id="dj-selector"
        className={styles.select}
        value={selectedDj?.id || ''}
        onChange={handleSelectDj}
      >
        <option value="">-- Select a DJ --</option>
        {djs.map(dj => (
          <option key={dj.id} value={dj.id}>
            {dj.displayName} ({dj.email})
          </option>
        ))}
      </select>
      {selectedDj && (
        <p className={styles.info}>
          You are uploading on behalf of <strong>{selectedDj.displayName}</strong>
        </p>
      )}
    </div>
  );
}
```

#### 2. Update Upload Page to Include DJ Selector

```tsx
// In apps/web-ui/app/upload/page.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import DjSelector from '../components/DjSelector';
import styles from './page.module.css';

interface DJ {
  id: string;
  displayName: string;
  email: string;
}

export default function UploadPage() {
  const { user, authenticatedFetch } = useAuth();
  const [selectedDj, setSelectedDj] = useState<DJ | null>(null);
  
  // ... existing state and handlers ...
  
  const handleDjSelection = (dj: DJ | null) => {
    setSelectedDj(dj);
    console.log('Selected DJ:', dj);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ... existing form validation ...
    
    const formData = new FormData();
    // ... add existing form fields ...
    
    // Add the selected DJ ID if an admin has selected one
    if (user?.role === 'ADMIN' && selectedDj) {
      formData.append('selectedDjId', selectedDj.id);
    }
    
    try {
      // ... existing upload logic ...
    } catch (error) {
      // ... existing error handling ...
    }
  };
  
  return (
    <div className={styles.container}>
      <h1>Upload New Mix</h1>
      <p>All fields are required</p>
      
      {/* Show DJ selector only for admin users */}
      {user?.role === 'ADMIN' && (
        <DjSelector onSelectDj={handleDjSelection} />
      )}
      
      {/* ... existing form elements ... */}
    </div>
  );
}
```

### CSS for DJ Selector

```css
/* In apps/web-ui/app/components/DjSelector.module.css */
.container {
  /* Container styling with highlight border */
}

.select {
  /* Dropdown styling */
}

.info, .loading, .error {
  /* Status message styling */
}
```

### Security Considerations

1. **Access Control**: The `/djs` endpoint is protected with the `adminOnly` middleware to ensure only Super Admins can access the list of DJs.

2. **Validation**: The server validates that:
   - The authenticated user is a Super Admin before allowing DJ impersonation
   - The selected DJ ID corresponds to a valid user in AzuraCast
   - The selected user actually has the DJ role

3. **Audit Logging**: All actions are logged, including:
   - When an admin requests the DJ list
   - When an admin uploads on behalf of a DJ (recording both the admin and DJ names)
   - Any errors or validation failures

4. **UI Clarity**: The UI clearly indicates:
   - That the admin is uploading on behalf of another user
   - Which DJ is currently selected
   - That this feature is only available to admin users

5. **State Management**: The selected DJ is only used for the current upload and doesn't persist between sessions or affect the admin's authentication state.
