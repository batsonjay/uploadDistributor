import { parseSonglist, type ParseResult } from '@uploadDistributor/songlist-parser';
import { logDestinationStatus, LogType } from '../utils/LoggingUtils.js';
import * as path from 'path';

export class SonglistParserService {
  static async parse(filePath: string): Promise<ParseResult> {
    try {
      logDestinationStatus('SonglistParser', LogType.INFO, path.basename(filePath), 'Starting to parse songlist');
      const result = await parseSonglist(filePath);
      logDestinationStatus('SonglistParser', LogType.INFO, path.basename(filePath), `Parsing complete, found ${result.songs.length} songs`);
      return result;
    } catch (error) {
      logDestinationStatus('SonglistParser', LogType.ERROR, path.basename(filePath), `Error parsing songlist: ${error}`);
      throw error;
    }
  }
}
