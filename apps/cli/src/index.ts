import 'dotenv/config';
import { Command } from 'commander';
import { authenticate, uploadFiles } from './commands';
import { promptForFiles, promptForMetadata } from './prompts';

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

program.parse(process.argv);
