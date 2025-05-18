import { readFile } from 'fs/promises';
import * as xml2js from 'xml2js';
import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import { logParserEvent, ParserLogType } from '../utils/LoggingUtils.js';
import * as path from 'path';

export class NMLParser implements SonglistParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      // Log start of parsing
      logParserEvent('NMLParser', ParserLogType.INFO, `Starting to parse file: ${path.basename(filePath)}`);
      
      const xml = await readFile(filePath, 'utf8');
      logParserEvent('NMLParser', ParserLogType.DEBUG, `Read XML file, length: ${xml.length}`);
      
      const parser = new xml2js.Parser();
      
      try {
        const result = await parser.parseStringPromise(xml);
        logParserEvent('NMLParser', ParserLogType.DEBUG, `Successfully parsed XML structure`);
        
        let songs: Song[] = [];
        if (result?.NML?.COLLECTION?.[0]?.ENTRY) {
          logParserEvent('NMLParser', ParserLogType.DEBUG, `Found ${result.NML.COLLECTION[0].ENTRY.length} entries in collection`);
          
          songs = result.NML.COLLECTION[0].ENTRY.map((entry: any) => ({
            title: entry.$.TITLE || 'Unknown Title',
            artist: entry.$.ARTIST || 'Unknown Artist'
          }));
        } else {
          logParserEvent('NMLParser', ParserLogType.WARNING, `No ENTRY elements found in NML structure`);
        }
        
        logParserEvent('NMLParser', ParserLogType.INFO, `Completed parsing, found ${songs.length} songs`);
        return {
          songs,
          error: songs.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
        };
      } catch (err) {
        logParserEvent('NMLParser', ParserLogType.ERROR, `Error parsing NML file: ${err}`);
        return {
          songs: [],
          error: ParseError.UNKNOWN_ERROR
        };
      }
    } catch (err) {
      logParserEvent('NMLParser', ParserLogType.ERROR, `Error reading NML file: ${err}`);
      return {
        songs: [],
        error: ParseError.FILE_READ_ERROR
      };
    }
  }
}
