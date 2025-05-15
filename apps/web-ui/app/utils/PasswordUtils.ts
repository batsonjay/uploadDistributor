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
