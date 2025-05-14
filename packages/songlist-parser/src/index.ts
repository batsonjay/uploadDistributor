import { NMLParser } from './parsers/nmlParser.js';
import { TXTParser } from './parsers/txtParser.js';
import { TextractParser } from './parsers/textractParser.js';
import { Song, ParseResult, ParseError } from './types.js';
import { readFile } from 'fs/promises';

export type { Song, ParseResult } from './types.js';
export { ParseError } from './types.js';

export async function parseSonglist(filePath: string): Promise<ParseResult> {
  console.log('parseSonglist called with:', filePath);
  // Get file extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  try {
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
        case 'docx':
          parser = new TextractParser();
          break;
        default:
          return {
            songs: [],
            error: ParseError.FILE_READ_ERROR
          };
      }
    }
    
    try {
      const result = await parser.parse(filePath);
      // If it's a ParseResult (from TXT or Textract parser), return it directly
      if ('error' in result) {
        return result;
      }
      // If it's a Song[] (from NML parser), wrap it in a ParseResult
      return {
        songs: result,
        error: result.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
      };
    } catch (error) {
      console.error(`Error in parser.parse: ${error}`);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
    }
  } catch (error) {
    console.error(`Error in parseSonglist: ${error}`);
    return {
      songs: [],
      error: ParseError.UNKNOWN_ERROR
    };
  }
}

export { NMLParser, TXTParser, TextractParser };
