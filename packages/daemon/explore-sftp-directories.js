/**
 * Explore SFTP Directory Structure
 * 
 * This script explores the SFTP directory structure to find the correct
 * path for AzuraCast file uploads.
 */

import SftpClient from 'ssh2-sftp-client';

async function exploreSftpDirectories() {
  console.log('Exploring SFTP directory structure...');
  
  const sftp = new SftpClient();
  
  try {
    await sftp.connect({
      host: 'radio.balearic-fm.com',
      port: 2022,
      username: 'daemon',
      password: 'Bale.8012',
      readyTimeout: 10000,
      retries: 1
    });
    
    console.log('✅ SFTP connection successful');
    
    // Explore root directory
    console.log('\n1. Exploring root directory structure...');
    const rootFiles = await sftp.list('/');
    console.log('Root directory contents:');
    rootFiles.forEach(file => {
      console.log(`  ${file.type === 'd' ? '📁' : '📄'} ${file.name}`);
    });
    
    // Look for var directory
    if (rootFiles.some(f => f.name === 'var' && f.type === 'd')) {
      console.log('\n2. Exploring /var directory...');
      const varFiles = await sftp.list('/var');
      console.log('/var directory contents:');
      varFiles.forEach(file => {
        console.log(`  ${file.type === 'd' ? '📁' : '📄'} ${file.name}`);
      });
      
      // Look for azuracast directory
      if (varFiles.some(f => f.name === 'azuracast' && f.type === 'd')) {
        console.log('\n3. Exploring /var/azuracast directory...');
        const azuracastFiles = await sftp.list('/var/azuracast');
        console.log('/var/azuracast directory contents:');
        azuracastFiles.forEach(file => {
          console.log(`  ${file.type === 'd' ? '📁' : '📄'} ${file.name}`);
        });
        
        // Look for stations directory
        if (azuracastFiles.some(f => f.name === 'stations' && f.type === 'd')) {
          console.log('\n4. Exploring /var/azuracast/stations directory...');
          const stationsFiles = await sftp.list('/var/azuracast/stations');
          console.log('/var/azuracast/stations directory contents:');
          stationsFiles.forEach(file => {
            console.log(`  ${file.type === 'd' ? '📁' : '📄'} ${file.name}`);
          });
          
          // Look for station directories (1, 2, etc.)
          const stationDirs = stationsFiles.filter(f => f.type === 'd' && /^\d+$/.test(f.name));
          for (const stationDir of stationDirs) {
            console.log(`\n5. Exploring /var/azuracast/stations/${stationDir.name} directory...`);
            try {
              const stationFiles = await sftp.list(`/var/azuracast/stations/${stationDir.name}`);
              console.log(`/var/azuracast/stations/${stationDir.name} directory contents:`);
              stationFiles.forEach(file => {
                console.log(`  ${file.type === 'd' ? '📁' : '📄'} ${file.name}`);
              });
              
              // Look for files directory
              if (stationFiles.some(f => f.name === 'files' && f.type === 'd')) {
                console.log(`\n6. Exploring /var/azuracast/stations/${stationDir.name}/files directory...`);
                const filesFiles = await sftp.list(`/var/azuracast/stations/${stationDir.name}/files`);
                console.log(`/var/azuracast/stations/${stationDir.name}/files directory contents:`);
                filesFiles.forEach(file => {
                  console.log(`  ${file.type === 'd' ? '📁' : '📄'} ${file.name}`);
                });
                
                // Look for DJ directories
                const djDirs = filesFiles.filter(f => f.type === 'd');
                if (djDirs.length > 0) {
                  console.log(`\n7. Found DJ directories in station ${stationDir.name}:`);
                  djDirs.forEach(djDir => {
                    console.log(`  📁 ${djDir.name}`);
                  });
                  
                  // Check if catalyst directory exists
                  const catalystDir = djDirs.find(d => d.name.toLowerCase() === 'catalyst');
                  if (catalystDir) {
                    console.log(`\n8. Found catalyst directory! Exploring contents...`);
                    const catalystFiles = await sftp.list(`/var/azuracast/stations/${stationDir.name}/files/catalyst`);
                    console.log(`catalyst directory contents (${catalystFiles.length} items):`);
                    catalystFiles.slice(0, 10).forEach(file => {
                      console.log(`  ${file.type === 'd' ? '📁' : '📄'} ${file.name} (${file.size} bytes)`);
                    });
                    if (catalystFiles.length > 10) {
                      console.log(`  ... and ${catalystFiles.length - 10} more files`);
                    }
                  }
                }
              }
            } catch (error) {
              console.log(`  ❌ Error exploring station ${stationDir.name}: ${error.message}`);
            }
          }
        }
      }
    }
    
    // Also check if there's a direct path to files
    console.log('\n9. Testing direct access to common paths...');
    const testPaths = [
      '/files',
      '/uploads',
      '/media',
      '/azuracast/files',
      '/home/daemon/files'
    ];
    
    for (const testPath of testPaths) {
      try {
        const exists = await sftp.exists(testPath);
        if (exists) {
          console.log(`✅ Found: ${testPath}`);
          const files = await sftp.list(testPath);
          console.log(`  Contents (${files.length} items):`);
          files.slice(0, 5).forEach(file => {
            console.log(`    ${file.type === 'd' ? '📁' : '📄'} ${file.name}`);
          });
          if (files.length > 5) {
            console.log(`    ... and ${files.length - 5} more items`);
          }
        }
      } catch (error) {
        // Path doesn't exist or no access, continue
      }
    }
    
    await sftp.end();
    console.log('\n✅ Directory exploration completed');
    
  } catch (error) {
    console.error('❌ SFTP exploration failed:', error.message);
    try {
      await sftp.end();
    } catch (closeError) {
      // Ignore close errors
    }
  }
}

// Run the exploration
exploreSftpDirectories().catch(console.error);
