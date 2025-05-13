#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { authenticate, uploadFiles } from './commands.js';
import { promptForFiles, promptForMetadata, promptForSwap } from './prompts.js';
import { SonglistVerifier } from '@uploadDistributor/shared';

const program = new Command();

program
  .name('upload-cli')
  .description('CLI client for Upload Distributor')
  .version('0.1.0');

program
  .command('upload')
  .description('Upload files to the distributor')
  .action(async () => {
    try {
      // Authenticate with hardcoded credentials
      await authenticate({
        djName: process.env.DJ_NAME!,
        password: process.env.DJ_PASSWORD!
      });

      // Prompt for files and metadata
      const files = await promptForFiles();
      const metadata = await promptForMetadata();

      // Initiate upload
      await uploadFiles(files, metadata);
      console.log('Upload completed successfully');
    } catch (error) {
      if (error instanceof Error) {
        console.error('Upload failed:', error.message);
      } else {
        console.error('Upload failed:', error);
      }
      process.exit(1);
    }
  });

program
  .argument('<file>', 'Path to songlist file')
  .action(async (file) => {
    try {
      console.log('Verifying file:', file);
      // Convert relative path to absolute if needed
      const filePath = file.startsWith('/') ? file : `${process.cwd()}/${file}`;
      console.log('Absolute path:', filePath);
      // Parse the songlist using shared code
      const songs = await SonglistVerifier.verifySonglist(filePath);
      
      // Display the parsed songs
      console.log('Parsed songs:');
      console.log(JSON.stringify(songs, null, 2));
      
      // Ask if order needs to be swapped
      const shouldSwap = await promptForSwap();
      
      if (shouldSwap) {
        const swappedSongs = SonglistVerifier.swapTitleArtist(songs);
        console.log('\nSwapped songs:');
        console.log(JSON.stringify(swappedSongs, null, 2));
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('Verification failed:', error.message);
      } else {
        console.error('Verification failed with unknown error');
      }
      process.exit(1);
    }
  });

program.parse(process.argv);
