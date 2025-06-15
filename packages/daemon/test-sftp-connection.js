/**
 * Test SFTP Connection to AzuraCast
 * 
 * This script tests the SFTP connection and basic functionality
 * without performing a full upload.
 */

import { AzuraCastSftpApi } from './dist/apis/AzuraCastSftpApi.js';

async function testSftpConnection() {
  console.log('Testing SFTP connection to AzuraCast...');
  
  const sftpApi = new AzuraCastSftpApi();
  
  try {
    // Test 1: Basic connection
    console.log('\n1. Testing basic SFTP connection...');
    const connectionResult = await sftpApi.testConnection();
    
    if (connectionResult.success) {
      console.log('✅ SFTP connection successful');
    } else {
      console.log('❌ SFTP connection failed:', connectionResult.error);
      return;
    }
    
    // Test 2: Check if catalyst directory exists
    console.log('\n2. Checking if catalyst DJ directory exists...');
    const dirCheckResult = await sftpApi.checkDjDirectoryExists('catalyst');
    
    if (dirCheckResult.success) {
      if (dirCheckResult.exists) {
        console.log('✅ catalyst directory exists');
      } else {
        console.log('⚠️  catalyst directory does not exist');
      }
    } else {
      console.log('❌ Error checking catalyst directory:', dirCheckResult.error);
    }
    
    // Test 3: List files in catalyst directory (if it exists)
    if (dirCheckResult.success && dirCheckResult.exists) {
      console.log('\n3. Listing files in catalyst directory...');
      const filesResult = await sftpApi.listDjFiles('catalyst');
      
      if (filesResult.success && filesResult.files) {
        console.log(`✅ Found ${filesResult.files.length} files in catalyst directory`);
        if (filesResult.files.length > 0) {
          console.log('Recent files:');
          filesResult.files.slice(0, 5).forEach(file => {
            console.log(`  - ${file.name} (${file.size} bytes)`);
          });
        }
      } else {
        console.log('❌ Error listing files:', filesResult.error);
      }
    }
    
    console.log('\n✅ SFTP connection test completed successfully');
    
  } catch (error) {
    console.error('❌ SFTP test failed:', error.message);
  }
}

// Run the test
testSftpConnection().catch(console.error);
