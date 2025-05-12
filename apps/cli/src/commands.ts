import fs from 'fs';
import { UploadFiles, UploadMetadata, ProcessedFiles } from './types';

export async function authenticate(credentials: { djName: string; password: string }) {
  // TODO: Implement authentication
  console.log(`Authenticating as ${credentials.djName}...`);
}

export async function uploadFiles(files: UploadFiles, metadata: UploadMetadata) {
  // Convert file paths to ReadableStreams
  const filesWithStreams: ProcessedFiles = {
    audioFile: fs.createReadStream(files.audioFile),
    songlistFile: fs.createReadStream(files.songlistFile),
    artworkFile: files.artworkFile ? fs.createReadStream(files.artworkFile) : undefined
  };

  // TODO: Implement file upload
  console.log('\nUploading files:');
  console.log('- Audio:', files.audioFile);
  console.log('- Songlist:', files.songlistFile);
  if (files.artworkFile) {
    console.log('- Artwork:', files.artworkFile);
  }
  console.log('\nMetadata:');
  console.log(metadata);
  console.log('\nUpload process started...');
}
