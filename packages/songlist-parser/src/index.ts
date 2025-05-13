import { NMLParser } from './parsers/nmlParser.js';
import { TXTParser } from './parsers/txtParser.js';
import { TextractParser } from './parsers/textractParser.js';
import { Song } from './types.js';
import { readFile } from 'fs/promises';

export type { Song } from './types.js';

export async function parseSonglist(filePath: string): Promise<Song[]> {
  console.log('parseSonglist called with:', filePath);
  // Get file extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  // Read first line to check for Rekordbox format
  console.log('Reading file:', filePath);
  const firstLine = (await readFile(filePath, 'utf8')).split('\n')[0];
  const isRekordbox = firstLine?.startsWith('#\tArtwork\tTrack Title\tArtist') || false;
  
  let parser;
  
  if (isRekordbox) {
    parser = new TXTParser();
  } else {
    switch (ext) {
      case 'nml':
        parser = new NMLParser();
        break;
      case 'txt':
        parser = new TXTParser();
        break;
      case 'rtf':
        parser = new TextractParser();
        break;
      default:
        throw new Error(`Unsupported file format: ${ext}`);
    }
  }
  
  return await parser.parse(filePath);
}

export { NMLParser, TXTParser, TextractParser };
