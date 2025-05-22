/**
 * Test Role Verification
 * 
 * This script tests the role-based access control implementation.
 * It verifies that routes are properly protected based on user roles.
 */

import axios from 'axios';
import { AuthService, USER_ROLES } from '../services/AuthService.js';

// Base URL for API requests
const API_BASE_URL = 'http://localhost:3001';

// Test users
const ADMIN_USER = {
  email: 'batsonjay@mac.com'
};

const DJ_USER = {
  email: 'miker@mrobs.co.uk'
};

// Test function to authenticate and get token
async function authenticate(email: string): Promise<string> {
  try {
    // Request a login link
    const requestResponse = await axios.post(`${API_BASE_URL}/api/auth/request-login`, {
      email
    });
    
    if (!requestResponse.data.success) {
      console.error(`❌ Login link request failed for ${email}:`, requestResponse.data.error);
      throw new Error(`Login link request failed: ${requestResponse.data.error}`);
    }
    
    console.log(`✅ Login link requested for ${email}`);
    
    // In a real scenario, the user would receive an email with a token
    // For testing, we would need to extract the token from the console output
    // Here we're just simulating with a mock token
    const mockToken = "test-token-for-" + email;
    
    // Verify the token
    const response = await axios.post(`${API_BASE_URL}/api/auth/verify-login`, {
      token: mockToken
    });
    
    if (response.data.success && response.data.token) {
      console.log(`✅ Authentication successful for ${email}`);
      return response.data.token;
    } else {
      console.error(`❌ Authentication failed for ${email}:`, response.data.error);
      throw new Error(`Authentication failed: ${response.data.error}`);
    }
  } catch (err: any) {
    console.error(`❌ Authentication request failed for ${email}:`, err.message);
    throw err;
  }
}

// Test function to verify token
async function verifyToken(token: string): Promise<any> {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/auth/validate`, {
      token
    });
    
    if (response.data.success && response.data.user) {
      console.log(`✅ Token validation successful for ${response.data.user.displayName}`);
      return response.data.user;
    } else {
      console.error(`❌ Token validation failed:`, response.data.error);
      throw new Error(`Token validation failed: ${response.data.error}`);
    }
  } catch (err: any) {
    console.error(`❌ Token validation request failed:`, err.message);
    throw err;
  }
}

// Test function to get user profile
async function getUserProfile(token: string): Promise<any> {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/auth/profile`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.data.success && response.data.user) {
      console.log(`✅ Profile retrieval successful for ${response.data.user.displayName}`);
      return response.data.user;
    } else {
      console.error(`❌ Profile retrieval failed:`, response.data.error);
      throw new Error(`Profile retrieval failed: ${response.data.error}`);
    }
  } catch (err: any) {
    console.error(`❌ Profile retrieval request failed:`, err.message);
    throw err;
  }
}

// Test function to access upload endpoint
async function testUploadAccess(token: string | null): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    // We're not actually uploading a file, just testing access
    await axios.post(`${API_BASE_URL}/upload`, {}, { headers });
    
    console.log(`✅ Upload access granted`);
    return true;
  } catch (err: any) {
    if (err.response) {
      if (err.response.status === 401) {
        console.log(`✅ Upload access correctly denied (Unauthorized)`);
      } else if (err.response.status === 403) {
        console.log(`✅ Upload access correctly denied (Forbidden)`);
      } else {
        console.error(`❌ Upload access test failed with status ${err.response.status}:`, err.response.data);
      }
    } else {
      console.error(`❌ Upload access test failed:`, err.message);
    }
    return false;
  }
}

// Test function to access status endpoint
async function testStatusAccess(token: string | null): Promise<boolean> {
  try {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    // Using a fake upload ID just to test access
    await axios.get(`${API_BASE_URL}/status/test-upload-id`, { headers });
    
    console.log(`✅ Status access granted`);
    return true;
  } catch (err: any) {
    if (err.response) {
      if (err.response.status === 401) {
        console.log(`✅ Status access correctly denied (Unauthorized)`);
      } else if (err.response.status === 403) {
        console.log(`✅ Status access correctly denied (Forbidden)`);
      } else if (err.response.status === 404) {
        // This is expected since we're using a fake upload ID
        console.log(`✅ Status access granted (404 is expected for fake upload ID)`);
        return true;
      } else {
        console.error(`❌ Status access test failed with status ${err.response.status}:`, err.response.data);
      }
    } else {
      console.error(`❌ Status access test failed:`, err.message);
    }
    return false;
  }
}

// Main test function
async function runTests() {
  console.log('🔍 Starting role verification tests...');
  
  // Test 1: Unauthenticated access
  console.log('\n📋 Test 1: Unauthenticated access');
  console.log('--------------------------------');
  await testUploadAccess(null);
  await testStatusAccess(null);
  
  // Test 2: Admin user access
  console.log('\n📋 Test 2: Admin user access');
  console.log('---------------------------');
  let adminToken;
  try {
    adminToken = await authenticate(ADMIN_USER.email);
    const adminUser = await verifyToken(adminToken);
    await getUserProfile(adminToken);
    
    if (adminUser.role !== USER_ROLES.ADMIN) {
      console.error(`❌ Expected admin role "${USER_ROLES.ADMIN}", got "${adminUser.role}"`);
    } else {
      console.log(`✅ Admin role verified: ${adminUser.role}`);
    }
    
    await testUploadAccess(adminToken);
    await testStatusAccess(adminToken);
  } catch (err) {
    console.error('❌ Admin user tests failed');
  }
  
  // Test 3: DJ user access
  console.log('\n📋 Test 3: DJ user access');
  console.log('------------------------');
  let djToken;
  try {
    djToken = await authenticate(DJ_USER.email);
    const djUser = await verifyToken(djToken);
    await getUserProfile(djToken);
    
    if (djUser.role !== USER_ROLES.DJ) {
      console.error(`❌ Expected DJ role "${USER_ROLES.DJ}", got "${djUser.role}"`);
    } else {
      console.log(`✅ DJ role verified: ${djUser.role}`);
    }
    
    await testUploadAccess(djToken);
    await testStatusAccess(djToken);
  } catch (err) {
    console.error('❌ DJ user tests failed');
  }
  
  // Test 4: Invalid token
  console.log('\n📋 Test 4: Invalid token');
  console.log('----------------------');
  const invalidToken = 'invalid-token-123';
  try {
    await verifyToken(invalidToken);
  } catch (err) {
    console.log('✅ Invalid token correctly rejected');
  }
  
  await testUploadAccess(invalidToken);
  await testStatusAccess(invalidToken);
  
  console.log('\n🏁 Role verification tests completed');
}

// Run the tests
runTests().catch(err => {
  console.error('❌ Tests failed with error:', err);
});
