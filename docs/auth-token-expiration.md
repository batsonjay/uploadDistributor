# Authentication Token Expiration

*Updated on 2025/05/18*

This document explains the implementation of token expiration in the Upload Distributor application.

## Overview

The authentication system uses a client-side token expiration mechanism with role-based expiration times:
- DJ users are automatically logged out after 24 hours
- Super Admin users have extended sessions (10 years) for convenience

This approach was chosen for its simplicity and appropriateness for a small, localized application with trusted users.

## Implementation Details

The token expiration is implemented entirely on the client side using localStorage to store both the authentication token and its expiration timestamp.

### Key Components

1. **Token Storage**
   - The authentication token is stored in localStorage under the key `authToken`
   - The token expiration timestamp is stored in localStorage under the key `tokenExpires`

2. **Role-Based Expiration Times**
   - DJ users: 24 hours from login time
   - Super Admin users: 10 years from login time (effectively permanent)

3. **Expiration Check on Application Load**
   - When the application loads, it checks if the current time has passed the stored expiration timestamp
   - If the token has expired, the user is automatically logged out and redirected to the login page

4. **Periodic Expiration Check**
   - A periodic check runs every minute to verify if the token has expired
   - This ensures that users are logged out even if they keep the application open past their expiration time

5. **Expiration Timestamp Management**
   - The expiration timestamp is calculated and set when a user logs in, based on their role
   - For DJ users: `Date.now() + (24 * 60 * 60 * 1000)` (current time + 24 hours)
   - For Super Admin users: `Date.now() + (10 * 365 * 24 * 60 * 60 * 1000)` (current time + 10 years)

## Code Implementation

The updated token expiration logic will be implemented in the `AuthProvider` component in `apps/web-ui/app/auth/AuthContext.tsx`:

```typescript
// During login - calculate expiration based on role
const login = async (email: string) => {
  try {
    // ... authentication logic ...
    
    if (data.success) {
      setUser(data.user);
      setToken(data.token);
      
      // Calculate expiration time based on role
      const expirationTime = data.user.role === 'Super Administrator'
        ? Date.now() + (10 * 365 * 24 * 60 * 60 * 1000) // 10 years for admins
        : Date.now() + (24 * 60 * 60 * 1000); // 24 hours for DJs
      
      // Store token and expiration time
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('tokenExpires', expirationTime.toString());
      
      router.push('/upload');
      return { success: true };
    }
    // ... rest of function ...
  }
};

// Check for token expiration on application load
useEffect(() => {
  const storedToken = localStorage.getItem('authToken');
  const tokenExpires = localStorage.getItem('tokenExpires');
  
  if (storedToken && tokenExpires) {
    const expirationTime = parseInt(tokenExpires, 10);
    const currentTime = Date.now();
    
    // If current time is past expiration, log out
    if (currentTime > expirationTime) {
      console.log('Token has expired, logging out');
      logout();
      return;
    }
    
    validateToken(storedToken);
  } else {
    setIsLoading(false);
  }
}, []);

// Periodic check for token expiration
useEffect(() => {
  if (!token) return;
  
  const tokenExpires = localStorage.getItem('tokenExpires');
  if (!tokenExpires) return;
  
  const checkInterval = setInterval(() => {
    const expirationTime = parseInt(tokenExpires, 10);
    const currentTime = Date.now();
    
    if (currentTime > expirationTime) {
      console.log('Token has expired during session, logging out');
      logout();
    }
  }, 60000); // Check every minute
  
  return () => clearInterval(checkInterval);
}, [token]);
```

## Security Considerations

This implementation provides a basic level of security appropriate for the application's needs:

- It ensures that DJ users must re-authenticate after 24 hours
- It provides convenience for Super Admin users with extended sessions
- It prevents unauthorized access by automatically logging out expired sessions
- It's entirely client-side, making it simple to implement and maintain
- No sensitive role information is stored directly in localStorage

For applications with higher security requirements, a more robust server-side token expiration mechanism would be recommended.

## Behavior with Browser Storage Clearing

- If a user clears their localStorage (or all site data), they will be logged out
- If a user only clears cookies, they will remain logged in because the token is stored in localStorage, not cookies
- If a user uses private/incognito browsing, the token will not persist between sessions
- Super Admin users will need to re-authenticate if they clear their browser data, even though their sessions are designed to be long-lived

## Testing

For detailed instructions on how to test the token expiration functionality using browser developer tools, see [Testing Token Expiration](./testing-token-expiration.md).

The testing document will be updated to include instructions for testing both DJ and Super Admin expiration times.

## Future Enhancements

Potential future enhancements to the authentication system could include:

1. Server-side token validation with expiration
2. Refresh token mechanism for extending sessions
3. Further refinement of role-based expiration policies
4. Activity-based expiration (logout after period of inactivity)
5. Email-based one-time login links instead of password authentication
