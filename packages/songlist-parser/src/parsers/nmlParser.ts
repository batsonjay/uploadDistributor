import * as fs from 'fs';
import * as xml2js from 'xml2js';
import { Song } from '../types';
import { SonglistParser } from './parser';

export class NMLParser implements SonglistParser {
  parse(filePath: string): Song[] {
    const xml = fs.readFileSync(filePath, 'utf8');
    const parser = new xml2js.Parser();
    
    let songs: Song[] = [];
    
    parser.parseString(xml, (err: Error | null, result: any) => {
      if (err) {
        throw new Error(`Failed to parse NML file: ${err.message}`);
      }
      
      if (result?.NML?.COLLECTION?.[0]?.ENTRY) {
        songs = result.NML.COLLECTION[0].ENTRY.map((entry: any) => ({
          title: entry.$.TITLE || 'Unknown Title',
          artist: entry.$.ARTIST || 'Unknown Artist'
        }));
      }
    });
    
    return songs;
  }
}
