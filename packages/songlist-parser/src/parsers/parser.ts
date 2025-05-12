import { Song } from '../types.js';

export interface SonglistParser {
  parse(filePath: string): Promise<Song[]>;
}

export default SonglistParser;
