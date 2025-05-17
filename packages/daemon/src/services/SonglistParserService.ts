import { parseSonglist, type ParseResult } from '@uploadDistributor/songlist-parser';

export class SonglistParserService {
  static async parse(filePath: string): Promise<ParseResult> {
    try {
      return await parseSonglist(filePath);
    } catch (error) {
      console.error('Error in SonglistParserService:', error);
      throw error;
    }
  }
}
