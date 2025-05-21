# Testing Token Expiration

*Updated on 2025/05/18*

This document provides instructions for manually testing the role-based token expiration implementation using browser developer tools.

## Overview

The token expiration mechanism stores an expiration timestamp in localStorage when a user logs in, and checks if the current time has passed this timestamp on application load and periodically during the session. The expiration time varies by role:

- DJ users: 24 hours from login time
- Super Admin users: 10 years from login time (effectively permanent)

To test this functionality without waiting for the actual expiration periods, you can manually modify the expiration timestamp in localStorage using browser developer tools.

## Testing in Chrome

1. **Open the application in Chrome** and log in with valid credentials
2. **Open Chrome Developer Tools** by:
   - Right-clicking anywhere on the page and selecting "Inspect"
   - Or pressing `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. **Navigate to the Application tab**:
   - Click on the "Application" tab in the developer tools panel
   - If you don't see the Application tab, click the >> (more tabs) button and select "Application"
4. **Access localStorage**:
   - In the left sidebar, expand "Local Storage"
   - Click on the application domain (e.g., "http://localhost:3000")
5. **Locate the tokenExpires entry**:
   - You should see a list of key-value pairs, including "tokenExpires"
   - The value will be a timestamp in milliseconds representing when the token expires
6. **Modify the timestamp**:
   - Double-click on the value of "tokenExpires"
   - Change it to a timestamp that is in the past
   - For example, set it to `Date.now() - 3600000` (one hour ago)
7. **Test the expiration**:
   - Refresh the page
   - The application should automatically log you out
   - You should be redirected to the login page

## Testing in Firefox

1. **Open the application in Firefox** and log in with valid credentials
2. **Open Firefox Developer Tools** by:
   - Right-clicking anywhere on the page and selecting "Inspect Element"
   - Or pressing `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. **Navigate to the Storage tab**:
   - Click on the "Storage" tab in the developer tools panel
   - If you don't see the Storage tab, click the >> (more tabs) button and select "Storage"
4. **Access localStorage**:
   - In the left sidebar, expand "Local Storage"
   - Click on the application domain (e.g., "http://localhost:3000")
5. **Locate the tokenExpires entry**:
   - You should see a list of key-value pairs, including "tokenExpires"
   - The value will be a timestamp in milliseconds representing when the token expires
6. **Modify the timestamp**:
   - Double-click on the value of "tokenExpires"
   - Change it to a timestamp that is in the past
   - For example, set it to `Date.now() - 3600000` (one hour ago)
7. **Test the expiration**:
   - Refresh the page
   - The application should automatically log you out
   - You should be redirected to the login page

## Alternative Method: Using the Console

You can also modify localStorage using the browser console in either Chrome or Firefox:

1. **Open the browser console**:
   - In the developer tools, click on the "Console" tab
2. **Modify the timestamp with JavaScript**:
   ```javascript
   // Get the current expiration timestamp
   const expirationTimestamp = localStorage.getItem('tokenExpires');
   console.log('Current expiration timestamp:', expirationTimestamp);
   
   // Calculate a timestamp from 1 hour ago (expired)
   const expiredTimestamp = Date.now() - (1 * 60 * 60 * 1000);
   console.log('Expired timestamp:', expiredTimestamp);
   
   // Set the expired timestamp
   localStorage.setItem('tokenExpires', expiredTimestamp.toString());
   console.log('Expiration timestamp updated to:', localStorage.getItem('tokenExpires'));
   ```
3. **Refresh the page** to test the expiration

## Testing Different User Roles

To test the different expiration behaviors for DJ and Super Admin users:

### Testing DJ Expiration (24 hours)

1. **Log in as a DJ user**
2. **Check the tokenExpires value** in localStorage
3. **Verify it's set to approximately 24 hours** from the current time
4. **To test expiration**, set the tokenExpires to a past timestamp as described above

### Testing Super Admin Expiration (10 years)

1. **Log in as a Super Admin user**
2. **Check the tokenExpires value** in localStorage
3. **Verify it's set to approximately 10 years** from the current time
4. **To test expiration**, set the tokenExpires to a past timestamp as described above

The behavior should be the same for both user types when the token expires (automatic logout), but the initial expiration timestamp will be very different.

## Calculating Timestamps

If you need to calculate specific timestamps for testing:

- **Current timestamp**: `Date.now()` returns the current timestamp in milliseconds
- **24 hours in milliseconds**: 24 * 60 * 60 * 1000 = 86400000
- **10 years in milliseconds**: 10 * 365 * 24 * 60 * 60 * 1000 = 315360000000
- **Timestamp for 24 hours from now**: `Date.now() + 86400000`
- **Timestamp for 10 years from now**: `Date.now() + 315360000000`
- **Timestamp from 1 hour ago (expired)**: `Date.now() - 3600000`

## Expected Behavior

When testing token expiration:

1. If the current time is before the expiration timestamp, you should remain logged in after refreshing the page
2. If the current time is after the expiration timestamp, you should be automatically logged out and redirected to the login page
3. The console should log a message: "Token has expired, logging out"

The behavior should be consistent regardless of user role - the only difference is how far in the future the expiration timestamp is set during login.

## Troubleshooting

If the expiration doesn't work as expected:

1. **Check the console for errors**:
   - Open the browser console to see if there are any error messages
2. **Verify the timestamp format**:
   - Make sure the timestamp is a numeric string (e.g., "1715011200000")
   - Don't include quotes or other characters in the value
3. **Check both localStorage keys**:
   - Verify that both "authToken" and "tokenExpires" exist in localStorage
4. **Try clearing localStorage completely**:
   - In the console, run `localStorage.clear()`
   - Log in again to set fresh values
5. **Check user role**:
   - The expiration time is set based on the user's role
   - Verify you're testing with the correct user type (DJ or Super Admin)
