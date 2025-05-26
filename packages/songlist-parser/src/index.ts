import { NMLParser } from './parsers/nmlParser.js';
import { TXTParser } from './parsers/txtParser.js';
import { TextractParser } from './parsers/textractParser.js';
import { M3U8Parser } from './parsers/m3u8Parser.js';
import { Song, ParseResult, ParseError } from './types.js';
import { readFile } from 'fs/promises';
import { log, logError } from '@uploadDistributor/logging';

export type { Song, ParseResult } from './types.js';
export { ParseError } from './types.js';

export async function parseSonglist(filePath: string): Promise<ParseResult> {
  log('D:PARSER', 'SP:101', `parseSonglist called with: ${filePath}`);
  // Get file extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  try {
    // Read first line to check for Rekordbox format
    log('D:PARSDB', 'SP:102', `Reading file: ${filePath}`);
    const firstLine = (await readFile(filePath, 'utf8')).split('\n')[0];
    const isRekordbox = firstLine?.startsWith('#\tArtwork\tTrack Title\tArtist') || false;
    
    let parser;
    
    if (isRekordbox) {
      log('D:PARSER', 'SP:103', `Detected Rekordbox format file`);
      parser = new TXTParser();
    } else {
      switch (ext) {
        case 'nml':
          log('D:PARSER', 'SP:104', `Using NMLParser for .nml file`);
          parser = new NMLParser();
          break;
        case 'txt':
          log('D:PARSER', 'SP:105', `Using TXTParser for .txt file`);
          parser = new TXTParser();
          break;
        case 'm3u8':
          log('D:PARSER', 'SP:106', `Using M3U8Parser for .m3u8 file`);
          parser = new M3U8Parser();
          break;
        case 'rtf':
        case 'docx':
          log('D:PARSER', 'SP:107', `Using TextractParser for .${ext} file`);
          parser = new TextractParser();
          break;
        default:
          logError('ERROR   ', 'SP:108', `Unsupported file extension: ${ext}`);
          return {
            songs: [],
            error: ParseError.FILE_READ_ERROR
          };
      }
    }
    
    try {
      log('D:PARSDB', 'SP:109', `Calling parser.parse`);
      const result = await parser.parse(filePath);
      // All parsers now return ParseResult, so we can return it directly
      log('D:PARSER', 'SP:110', `Parsing complete, found ${result.songs.length} songs`);
      return result;
    } catch (error) {
      logError('ERROR   ', 'SP:111', `Error in parser.parse:`, error);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
    }
  } catch (error) {
    logError('ERROR   ', 'SP:112', `Error in parseSonglist:`, error);
    return {
      songs: [],
      error: ParseError.UNKNOWN_ERROR
    };
  }
}

export { NMLParser, TXTParser, TextractParser, M3U8Parser };
