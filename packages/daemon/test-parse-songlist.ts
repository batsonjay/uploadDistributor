import * as fs from 'fs';
import * as path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import { encodePassword } from './src/utils/PasswordUtils.js';

async function authenticate() {
  try {
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'batsonjay@gmail.com',
      encodedPassword: encodePassword('test123')
    });
    return response.data.token;
  } catch (error) {
    console.error('Authentication failed:', error);
    throw error;
  }
}

async function testFile(filename: string) {
  try {
    // Get authentication token
    const token = await authenticate();

    // Create a form with the songlist file
    const form = new FormData();
    const filePath = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      '../../apps/tf',
      filename
    );
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    form.append('songlist', fs.createReadStream(filePath));

    // Send the request
    const response = await axios.post('http://localhost:3001/parse-songlist', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`\nParse Result for ${filename}:`, JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Error:', error.response?.data || error.message);
    } else {
      console.error('Error:', error);
    }
  }
}

// Test multiple files
async function runTests() {
  // Test RTF file
  await testFile('Cadence vol 19 tracklist.rtf');
  
  // Test DOCX file
  await testFile('2025-04-26_GIUGRI-J_024.docx');
}

runTests();
