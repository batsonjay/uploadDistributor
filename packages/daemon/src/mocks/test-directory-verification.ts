/**
 * Test script for directory verification in AuthService
 * 
 * This script tests the directory verification functionality in the AuthService.
 * It verifies that DJ users with valid directories can authenticate, while
 * those without valid directories receive an appropriate error message.
 */

import { AuthService } from '../services/AuthService.js';
import { encodePassword } from '../utils/PasswordUtils.js';

// Test users
const DJ_WITH_DIRECTORY = {
  email: 'batsonjay@mac.com', // catalyst - has a directory
  password: 'catalyst-password' // Valid password for catalyst
};

const DJ_WITHOUT_DIRECTORY = {
  email: 'batsonjay@mac.com', // Real user (catalyst)
  password: 'catalyst-password', // Valid password
  displayName: 'nonexistent-dj' // Fake display name that doesn't have a directory
};

/**
 * Test the directory verification functionality
 */
async function testDirectoryVerification() {
  try {
    console.log('Testing directory verification in AuthService...');
    
    // Get the AuthService instance
    const authService = AuthService.getInstance();
    
    // Test 1: DJ with valid directory (should succeed)
    console.log('\nTest 1: DJ with valid directory');
    const djWithDirResult = await authService.authenticateWithAzuraCast(
      DJ_WITH_DIRECTORY.email,
      encodePassword(DJ_WITH_DIRECTORY.password)
    );
    console.log('DJ with directory result:', djWithDirResult);
    
    // Test 2: DJ without valid directory (should fail with specific error)
    console.log('\nTest 2: DJ without valid directory (using fake display name)');
    
    // For this test, we'll temporarily modify the AuthService to use a different display name
    // This simulates a user with valid credentials but no directory
    const originalVerifyDjDirectory = (AuthService.prototype as any).verifyDjDirectory;
    (AuthService.prototype as any).verifyDjDirectory = async function(djName: string): Promise<any> {
      console.log(`Overridden verifyDjDirectory called with: ${djName}`);
      // Use the fake display name instead of the real one
      return originalVerifyDjDirectory.call(this, DJ_WITHOUT_DIRECTORY.displayName);
    };
    
    const djWithoutDirResult = await authService.authenticateWithAzuraCast(
      DJ_WITHOUT_DIRECTORY.email,
      encodePassword(DJ_WITHOUT_DIRECTORY.password)
    );
    console.log('DJ without directory result:', djWithoutDirResult);
    
    // Restore the original method
    (AuthService.prototype as any).verifyDjDirectory = originalVerifyDjDirectory;
    
    // Print summary
    console.log('\n--- Summary ---');
    console.log(`DJ with directory: ${djWithDirResult.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`DJ without directory: ${!djWithoutDirResult.success ? 'FAILED (Expected)' : 'SUCCESS (Unexpected)'}`);
    
    if (djWithoutDirResult.success) {
      console.error('ERROR: DJ without directory should have failed authentication');
    } else {
      console.log(`Error message: "${djWithoutDirResult.error}"`);
      if (djWithoutDirResult.error === 'Media upload folder name mismatch; inform station administrator') {
        console.log('✅ Correct error message received');
      } else {
        console.error('❌ Unexpected error message');
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Unexpected error during directory verification testing:');
    console.error(error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Execute the function
testDirectoryVerification().then(result => {
  if (!result.success) {
    process.exit(1);
  }
});
