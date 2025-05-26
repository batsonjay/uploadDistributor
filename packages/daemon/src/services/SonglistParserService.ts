import { parseSonglist, type ParseResult } from '@uploadDistributor/songlist-parser';
import * as path from 'path';
import { log, logError } from '@uploadDistributor/logging';

export class SonglistParserService {
  static async parse(filePath: string): Promise<ParseResult> {
    try {
      log('D:PARSER', 'SP:001', `parseSonglist called with: ${filePath}`);
      
      const result = await parseSonglist(filePath);
      
      log('D:PARSER', 'SP:002', `Parsing complete, found ${result.songs.length} songs`);
      log('D:PARSDB', 'SP:003', `Parser result: ${JSON.stringify(result, null, 2)}`);
      
      return result;
    } catch (error) {
      logError('ERROR   ', 'SP:004', `Error parsing songlist ${path.basename(filePath)}:`, error);
      throw error;
    }
  }
}
