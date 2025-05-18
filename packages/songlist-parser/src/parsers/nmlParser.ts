import { readFile } from 'fs/promises';
import * as xml2js from 'xml2js';
import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';

export class NMLParser implements SonglistParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      const xml = await readFile(filePath, 'utf8');
      const parser = new xml2js.Parser();
      
      try {
        const result = await parser.parseStringPromise(xml);
        
        let songs: Song[] = [];
        if (result?.NML?.COLLECTION?.[0]?.ENTRY) {
          songs = result.NML.COLLECTION[0].ENTRY.map((entry: any) => ({
            title: entry.$.TITLE || 'Unknown Title',
            artist: entry.$.ARTIST || 'Unknown Artist'
          }));
        }
        
        return {
          songs,
          error: songs.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
        };
      } catch (err) {
        console.error(`Error parsing NML file: ${err}`);
        return {
          songs: [],
          error: ParseError.UNKNOWN_ERROR
        };
      }
    } catch (err) {
      console.error(`Error reading NML file: ${err}`);
      return {
        songs: [],
        error: ParseError.FILE_READ_ERROR
      };
    }
  }
}
