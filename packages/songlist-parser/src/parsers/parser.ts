import { Song, ParseResult } from '../types.js';

export interface SonglistParser<T = ParseResult> {
  parse(filePath: string): Promise<T>;
}
