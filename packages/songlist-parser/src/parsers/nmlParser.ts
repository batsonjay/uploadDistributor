import { readFile } from 'fs/promises';
import * as xml2js from 'xml2js';
import { Song } from '../types.js';
import SonglistParser from './parser.js';

export class NMLParser implements SonglistParser {
  async parse(filePath: string): Promise<Song[]> {
    const xml = await readFile(filePath, 'utf8');
    const parser = new xml2js.Parser();
    
    try {
      const result = await parser.parseStringPromise(xml);
      
      if (result?.NML?.COLLECTION?.[0]?.ENTRY) {
        return result.NML.COLLECTION[0].ENTRY.map((entry: any) => ({
          title: entry.$.TITLE || 'Unknown Title',
          artist: entry.$.ARTIST || 'Unknown Artist'
        }));
      }
      
      return [];
    } catch (err) {
      if (err instanceof Error) {
        throw new Error(`Failed to parse NML file: ${err.message}`);
      }
      throw err;
    }
  }
}
