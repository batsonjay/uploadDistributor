import * as xml2js from 'xml2js';
import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { log, logError } from '@uploadDistributor/logging';

export class NMLParser implements SonglistParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      // Log start of parsing
      log('D:PARSER', 'NM:001', `Starting to parse file: ${path.basename(filePath)}`);
      
      const xml = await readFile(filePath, 'utf8');
      log('D:PARSDB', 'NM:002', `Read XML file, length: ${xml.length}`);
      
      const parser = new xml2js.Parser();
      
      try {
        const result = await parser.parseStringPromise(xml);
        log('D:PARSDB', 'NM:003', `Successfully parsed XML structure`);
        
        let songs: Song[] = [];
        if (result?.NML?.COLLECTION?.[0]?.ENTRY) {
          log('D:PARSDB', 'NM:004', `Found ${result.NML.COLLECTION[0].ENTRY.length} entries in collection`);
          
          songs = result.NML.COLLECTION[0].ENTRY.map((entry: any) => ({
            title: entry.$.TITLE || 'Unknown Title',
            artist: entry.$.ARTIST || 'Unknown Artist'
          }));
        } else {
          log('D:PARSER', 'NM:005', `No ENTRY elements found in NML structure`);
        }
        
        log('D:PARSER', 'NM:006', `Completed parsing, found ${songs.length} songs`);
        return {
          songs,
          error: songs.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
        };
      } catch (err) {
        logError('ERROR   ', 'NM:007', `Error parsing NML file: ${err}`);
        return {
          songs: [],
          error: ParseError.UNKNOWN_ERROR
        };
      }
    } catch (err) {
      logError('ERROR   ', 'NM:008', `Error reading NML file: ${err}`);
      return {
        songs: [],
        error: ParseError.FILE_READ_ERROR
      };
    }
  }
}
