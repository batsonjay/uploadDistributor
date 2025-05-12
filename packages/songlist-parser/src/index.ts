import { NMLParser } from './parsers/nmlParser.js';
import { TXTParser } from './parsers/txtParser.js';
import { TextractParser } from './parsers/textractParser.js';
import { Song } from './types.js';

export async function parseSonglist(filePath: string, format: string, useOriginalRtf: boolean = false): Promise<Song[]> {
  let parser;
  
  switch (format.toLowerCase()) {
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
      throw new Error(`Unsupported file format: ${format}`);
  }
  
  return await parser.parse(filePath);
}

// Only run if this is the main module
if (import.meta.url === new URL(import.meta.url).href) {
  try {
    const songs = await parseSonglist(
      process.argv[2] || '/Users/balearicfm/Projects/uploadDistributor/apps/tf/2025-05-09.nml',
      process.argv[3] || 'nml'
    );
    console.log('Parsed songs:', songs);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error parsing songlist:', error.message);
    } else {
      console.error('Unknown error occurred while parsing songlist');
    }
  }
}

export { NMLParser, TXTParser, TextractParser };
