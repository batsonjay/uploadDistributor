/**
 * Test script to authenticate with the AzuraCast API using real credentials
 * 
 * This script tests the authentication with the AzuraCast API using the provided
 * credentials and verifies that the returned DJ name is "catalyst".
 */

import { AuthService } from '../services/AuthService.js';
import { encodePassword } from '../utils/PasswordUtils.js';

async function testAzuraCastAuth() {
  try {
    console.log('Testing AzuraCast Authentication with Real API...');
    
    // Get AuthService instance
    const authService = AuthService.getInstance();
    
    // Test credentials
    const email = 'batsonjay@mac.com';
    const password = 'Bale.8012';
    const encodedPassword = encodePassword(password);
    
    console.log(`Authenticating user: ${email}`);
    
    // Authenticate with AzuraCast
    const result = await authService.authenticateWithAzuraCast(email, encodedPassword);
    
    if (result.success && result.user) {
      console.log('Authentication successful!');
      console.log('User details:');
      console.log(`- ID: ${result.user.id}`);
      console.log(`- Email: ${result.user.email}`);
      console.log(`- Display Name: ${result.user.displayName}`);
      console.log(`- Role: ${result.user.role}`);
      
      // Verify the display name is "catalyst"
      if (result.user.displayName === 'catalyst') {
        console.log('\n✅ VERIFICATION PASSED: Display name is "catalyst" as expected');
      } else {
        console.log(`\n❌ VERIFICATION FAILED: Expected display name "catalyst", got "${result.user.displayName}"`);
      }
      
      return { success: true, user: result.user };
    } else {
      console.error('Authentication failed:');
      console.error(result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('Unexpected error during authentication:');
    console.error(error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Execute the function
testAzuraCastAuth().then(result => {
  if (!result.success) {
    process.exit(1);
  }
});
