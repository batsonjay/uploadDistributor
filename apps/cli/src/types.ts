export interface UploadFiles {
  audioFile: string;
  songlistFile: string;
  artworkFile?: string;
}

export interface ProcessedFiles {
  audioFile: NodeJS.ReadableStream;
  songlistFile: NodeJS.ReadableStream;
  artworkFile?: NodeJS.ReadableStream;
}

export interface UploadMetadata {
  userId: string;
  title: string;
  djName: string;
  azcFolder: string;
  azcPlaylist: string;
  genre: string;
  userRole?: string;
  destinations?: string;
}
