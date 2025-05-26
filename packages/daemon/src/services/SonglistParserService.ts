import { parseSonglist, type ParseResult } from '@uploadDistributor/songlist-parser';
import * as path from 'path';
import { log, logError } from '@uploadDistributor/logging';

export class SonglistParserService {
  static async parse(filePath: string): Promise<ParseResult> {
    try {
      // The songlist-parser package already logs these events with SP:101 and SP:110
      const result = await parseSonglist(filePath);
      
      // Keep the detailed debug logging since it's unique to this service
      log('D:PARSDB', 'SP:003', `Parser result: ${JSON.stringify(result, null, 2)}`);
      
      return result;
    } catch (error) {
      logError('ERROR   ', 'SP:004', `Error parsing songlist ${path.basename(filePath)}:`, error);
      throw error;
    }
  }
}
