export interface Song {
  title: string;
  artist: string;
}

export enum ParseError {
  NONE = 'NONE',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  NO_TRACKS_DETECTED = 'NO_TRACKS_DETECTED',
  NO_VALID_SONGS = 'NO_VALID_SONGS',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ParseResult {
  songs: Song[];
  error: ParseError;
}
