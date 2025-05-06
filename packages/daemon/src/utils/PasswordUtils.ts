/**
 * Simple XOR-based password obfuscation
 * Note: This is not secure encryption, just basic obfuscation to avoid plaintext passwords
 */

// Fixed key for XOR operation
const FIXED_KEY = 'uploadDistributor2025';

/**
 * Encode a password using XOR with a fixed key
 * @param password The plaintext password
 * @returns The encoded password as a base64 string
 */
export function encodePassword(password: string): string {
  // Apply XOR with the fixed key
  let result = '';
  for (let i = 0; i < password.length; i++) {
    // Ensure we always have a valid index
    const keyIndex = i % FIXED_KEY.length;
    const keyChar = FIXED_KEY.charAt(keyIndex);
    const charCode = password.charCodeAt(i) ^ keyChar.charCodeAt(0);
    result += String.fromCharCode(charCode);
  }
  
  // Convert to base64 for safe transmission
  return Buffer.from(result).toString('base64');
}

/**
 * Decode an encoded password
 * @param encodedPassword The encoded password (base64 string)
 * @returns The plaintext password
 */
export function decodePassword(encodedPassword: string): string {
  // Decode from base64
  const xorResult = Buffer.from(encodedPassword, 'base64').toString();
  
  // Apply XOR with the fixed key to get the original password
  let result = '';
  for (let i = 0; i < xorResult.length; i++) {
    // Ensure we always have a valid index
    const keyIndex = i % FIXED_KEY.length;
    const keyChar = FIXED_KEY.charAt(keyIndex);
    const charCode = xorResult.charCodeAt(i) ^ keyChar.charCodeAt(0);
    result += String.fromCharCode(charCode);
  }
  
  return result;
}
