import { NMLParser } from './parsers/nmlParser.js';
import { TXTParser } from './parsers/txtParser.js';
import { TextractParser } from './parsers/textractParser.js';
import { M3U8Parser } from './parsers/m3u8Parser.js';
import { Song, ParseResult, ParseError } from './types.js';
import { readFile } from 'fs/promises';
import { logParserEvent, ParserLogType } from './utils/LoggingUtils.js';

export type { Song, ParseResult } from './types.js';
export { ParseError } from './types.js';
export { logParserEvent, ParserLogType } from './utils/LoggingUtils.js';

export async function parseSonglist(filePath: string): Promise<ParseResult> {
  logParserEvent('SonglistParser', ParserLogType.INFO, `parseSonglist called with: ${filePath}`);
  // Get file extension
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  try {
    // Read first line to check for Rekordbox format
    logParserEvent('SonglistParser', ParserLogType.DEBUG, `Reading file: ${filePath}`);
    const firstLine = (await readFile(filePath, 'utf8')).split('\n')[0];
    const isRekordbox = firstLine?.startsWith('#\tArtwork\tTrack Title\tArtist') || false;
    
    let parser;
    
    if (isRekordbox) {
      logParserEvent('SonglistParser', ParserLogType.INFO, `Detected Rekordbox format file`);
      parser = new TXTParser();
    } else {
      switch (ext) {
        case 'nml':
          logParserEvent('SonglistParser', ParserLogType.INFO, `Using NMLParser for .nml file`);
          parser = new NMLParser();
          break;
        case 'txt':
          logParserEvent('SonglistParser', ParserLogType.INFO, `Using TXTParser for .txt file`);
          parser = new TXTParser();
          break;
        case 'm3u8':
          logParserEvent('SonglistParser', ParserLogType.INFO, `Using M3U8Parser for .m3u8 file`);
          parser = new M3U8Parser();
          break;
        case 'rtf':
        case 'docx':
          logParserEvent('SonglistParser', ParserLogType.INFO, `Using TextractParser for .${ext} file`);
          parser = new TextractParser();
          break;
        default:
          logParserEvent('SonglistParser', ParserLogType.ERROR, `Unsupported file extension: ${ext}`);
          return {
            songs: [],
            error: ParseError.FILE_READ_ERROR
          };
      }
    }
    
    try {
      logParserEvent('SonglistParser', ParserLogType.DEBUG, `Calling parser.parse`);
      const result = await parser.parse(filePath);
      // All parsers now return ParseResult, so we can return it directly
      logParserEvent('SonglistParser', ParserLogType.INFO, `Parsing complete, found ${result.songs.length} songs`);
      return result;
    } catch (error) {
      logParserEvent('SonglistParser', ParserLogType.ERROR, `Error in parser.parse: ${error}`);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
    }
  } catch (error) {
    logParserEvent('SonglistParser', ParserLogType.ERROR, `Error in parseSonglist: ${error}`);
    return {
      songs: [],
      error: ParseError.UNKNOWN_ERROR
    };
  }
}

export { NMLParser, TXTParser, TextractParser, M3U8Parser };
