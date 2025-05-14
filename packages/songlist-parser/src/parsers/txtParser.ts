import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import { readFile } from 'fs/promises';

export class TXTParser implements SonglistParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      // Read file and detect encoding
      const buffer = await readFile(filePath);
      let content: string;
      
      // Check for UTF-16 LE BOM
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        content = buffer.toString('utf16le');
        // Remove BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
      }
      // Check for UTF-16 BE BOM
      else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        content = buffer.toString('utf16le');
        // Remove BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
      }
      // Default to UTF-8
      else {
        content = buffer.toString('utf8');
        // Remove BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
      }

      // Check if this is a Rekordbox file
      if (this.isRekordboxFile(content)) {
        const songs = this.parseRekordbox(content);
        return {
          songs,
          error: songs.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
        };
      }

      // Fall back to generic TXT parsing
      const songs = this.parseGenericTXT(content);
      return {
        songs,
        error: songs.length > 0 ? ParseError.NONE : ParseError.NO_TRACKS_DETECTED
      };
    } catch (error) {
      console.error(`Error parsing file: ${error}`);
      return {
        songs: [],
        error: ParseError.FILE_READ_ERROR
      };
    }
  }

  private isRekordboxFile(content: string): boolean {
    return content.startsWith('#\tArtwork\tTrack Title\tArtist');
  }

  private parseRekordbox(content: string): Song[] {
    const lines = content.split('\n').filter(line => line.trim() !== '');
    
    // Skip header line
    const trackLines = lines.slice(1);
    
    return trackLines.map(line => {
      // Split on tabs and convert empty/undefined values to empty strings
      const columns = line.split('\t').map(col => col?.trim() || '');
      
      // Find the first non-numeric, non-empty column after artwork (index 1)
      // This should be the title
      let titleIndex = -1;
      for (let i = 2; i < columns.length; i++) {  // Start at index 2 (Track Title column)
        const col = columns[i];
        if (col && !/^\d/.test(col)) {
          titleIndex = i;
          break;
        }
      }
      
      // Get the title
      const title = (titleIndex >= 0 && columns[titleIndex]) || 'Unknown Title';
      
      // Look for artist in the next column after title
      let artist = 'Unknown Artist';
      if (titleIndex >= 0 && titleIndex + 1 < columns.length) {
        const nextCol = columns[titleIndex + 1];
        // Only use it if it's not a BPM value
        if (nextCol && !/^\d+\.\d+$/.test(nextCol)) {
          artist = nextCol || 'Unknown Artist';
        }
      }
      
      return { title, artist };
    });
  }

  private parseGenericTXT(content: string): Song[] {
    const allLines = content.split('\n').filter(line => line.trim() !== '');
    
    // Find first line that starts with a number followed by a period
    const firstTrackIndex = allLines.findIndex(line => /^\d+\./.test(line));
    
    // If no track lines found, return empty array
    if (firstTrackIndex === -1) return [];
    
    // Only process lines from first track onward
    const lines = allLines.slice(firstTrackIndex);
    
    return lines.map(line => {
      // Remove track numbers if present
      const cleanedLine = line.replace(/^\d+\.\s*/, '');
      
      // Split on first occurrence of ' - ' or ' – ' (different dashes)
      const [firstPart, secondPart] = cleanedLine.split(/ - | – /);
      
      if (!firstPart) {
        return {
          title: 'Unknown Title',
          artist: 'Unknown Artist'
        };
      }
      
      return {
        title: firstPart.trim(),
        artist: secondPart?.trim() || 'Unknown Artist'
      };
    });
  }
}
