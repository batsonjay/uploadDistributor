/**
 * Test Password Utils
 * 
 * This script tests the password obfuscation utilities.
 * It encodes a password, then decodes it, and verifies that the original password is recovered.
 */

import { encodePassword, decodePassword } from '../utils/PasswordUtils.js';

// Test passwords
const passwords = [
  'password123',
  'SuperSecure!@#$%^&*()',
  'Short',
  'ThisIsAVeryLongPasswordThatExceedsTheKeyLength'
];

// Test each password
passwords.forEach(password => {
  process.stdout.write(`Testing password: ${password}\n`);
  
  // Encode the password
  const encoded = encodePassword(password);
  process.stdout.write(`Encoded: ${encoded}\n`);
  
  // Decode the password
  const decoded = decodePassword(encoded);
  process.stdout.write(`Decoded: ${decoded}\n`);
  
  // Verify that the decoded password matches the original
  if (decoded === password) {
    process.stdout.write('✅ Success: Decoded password matches original\n');
  } else {
    process.stderr.write('❌ Error: Decoded password does not match original\n');
    process.stderr.write(`Original: ${password}\n`);
    process.stderr.write(`Decoded: ${decoded}\n`);
  }
  
  process.stdout.write('\n');
});

// Test the login flow
process.stdout.write('Testing login flow with encoded password\n');

// Simulate a client-side encoding
const email = 'batsonjay@mac.com';
const password = 'admin-password';
const encodedPassword = encodePassword(password);

process.stdout.write(`Email: ${email}\n`);
process.stdout.write(`Password: ${password}\n`);
process.stdout.write(`Encoded Password: ${encodedPassword}\n`);

// In a real application, the client would send the email and encodedPassword to the server
// The server would then decode the password and authenticate the user

// Simulate server-side decoding
const decodedPassword = decodePassword(encodedPassword);

process.stdout.write(`Decoded Password: ${decodedPassword}\n`);

if (decodedPassword === password) {
  process.stdout.write('✅ Success: Login flow works correctly\n');
} else {
  process.stderr.write('❌ Error: Login flow failed\n');
}
