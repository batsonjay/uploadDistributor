import { Song } from '../types';

export interface SonglistParser {
  parse(filePath: string): Song[];
}

export default SonglistParser;
