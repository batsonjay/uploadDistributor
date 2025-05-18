import { Song } from '@uploadDistributor/songlist-parser';
import { parseSonglist } from '@uploadDistributor/songlist-parser';

export interface VerificationResult {
  songs: Song[];
  needsSwap: boolean;
}

export class SonglistVerifier {
  /**
   * Swap title and artist for all songs in the list
   */
  static swapTitleArtist(songs: Song[]): Song[] {
    return songs.map(song => ({
      title: song.artist,
      artist: song.title
    }));
  }

  /**
   * Parse a songlist file and return the songs
   */
  static async verifySonglist(filePath: string): Promise<Song[]> {
    const result = await parseSonglist(filePath);
    return result.songs;
  }
}
