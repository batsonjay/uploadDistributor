import * as readline from 'readline/promises';
import { UploadFiles, UploadMetadata } from './types';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const answer = await rl.question(`${question} ${defaultValue ? `[${defaultValue}] ` : ''}`);
  return answer || defaultValue || '';
}

export async function promptForFiles(): Promise<UploadFiles> {
  const audio = await prompt('Path to audio file (MP3):');
  const songlist = await prompt('Path to songlist file (TXT):');
  const artwork = await prompt('Path to artwork file (JPG/PNG):');

  const files: UploadFiles = {
    audioFile: audio,
    songlistFile: songlist
  };
  
  if (artwork) {
    files.artworkFile = artwork;
  }
  
  return files;
}

export async function promptForMetadata(): Promise<UploadMetadata> {
  return {
    userId: await prompt('User ID:', 'catalyst'),
    title: await prompt('Broadcast title:'),
    djName: await prompt('DJ name:', process.env.DJ_NAME),
    azcFolder: await prompt('AzuraCast folder:', 'catalyst'),
    azcPlaylist: await prompt('AzuraCast playlist:', 'catalyst-mixes'),
    genre: await prompt('Genre:')
  };
}
