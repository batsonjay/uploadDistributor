import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import { readFile } from 'fs/promises';
import type { RTFDocument } from 'rtf-parser';
import * as path from 'path';
import { log, logError } from '@uploadDistributor/logging';

export class TXTParser implements SonglistParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      // Log start of parsing
      log('D:PARSER', 'TX:001', `Starting to parse file: ${path.basename(filePath)}`);
      
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
        log('D:PARSDB', 'TX:002', `Detected UTF-16 LE encoding`);
      }
      // Check for UTF-16 BE BOM
      else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
        content = buffer.toString('utf16le');
        // Remove BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        log('D:PARSDB', 'TX:003', `Detected UTF-16 BE encoding`);
      }
      // Default to UTF-8
      else {
        content = buffer.toString('utf8');
        // Remove BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        log('D:PARSDB', 'TX:004', `Using default UTF-8 encoding`);
      }

      // Check if this is a Rekordbox file
      if (this.isRekordboxFile(content)) {
        log('D:PARSER', 'TX:005', `Detected Rekordbox format file`);
        const songs = this.parseRekordbox(content);
        log('D:PARSER', 'TX:006', `Completed parsing Rekordbox file, found ${songs.length} songs`);
        return {
          songs,
          error: songs.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
        };
      }

      // Fall back to generic TXT parsing
      log('D:PARSER', 'TX:007', `Using generic TXT parsing`);
      const songs = this.parseGenericTXT(content);
      log('D:PARSER', 'TX:008', `Completed parsing generic TXT file, found ${songs.length} songs`);
      return {
        songs,
        error: songs.length > 0 ? ParseError.NONE : ParseError.NO_TRACKS_DETECTED
      };
    } catch (error) {
      logError('ERROR   ', 'TX:009', `Error parsing file: ${error}`);
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
    log('D:PARSDB', 'TX:010', `Rekordbox file has ${lines.length} lines`);
    
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
      
      log('D:PARSDB', 'TX:011', `Parsed Rekordbox track: "${title}" by "${artist}"`);
      return { title, artist };
    });
  }

  private parseGenericTXT(content: string): Song[] {
    const allLines = content.split('\n').filter(line => line.trim() !== '');
    log('D:PARSDB', 'TX:012', `Generic TXT file has ${allLines.length} lines`);
    
    // Find first line that starts with a number followed by a period
    const firstTrackIndex = allLines.findIndex(line => /^\d+\./.test(line));
    
    // If no track lines found, return empty array
    if (firstTrackIndex === -1) {
      log('D:PARSER', 'TX:013', `No track lines found in generic TXT file`);
      return [];
    }
    
    // Only process lines from first track onward
    const lines = allLines.slice(firstTrackIndex);
    log('D:PARSDB', 'TX:014', `Found ${lines.length} potential track lines`);
    
    return lines.map(line => {
      // Remove track numbers if present
      const cleanedLine = line.replace(/^\d+\.\s*/, '');
      
      // Split on first occurrence of ' - ' or ' – ' (different dashes)
      const [firstPart, secondPart] = cleanedLine.split(/ - | – /);
      
      if (!firstPart) {
        log('D:PARSER', 'TX:015', `Invalid track line: ${line}`);
        return {
          title: 'Unknown Title',
          artist: 'Unknown Artist'
        };
      }
      
      const title = firstPart.trim();
      const artist = secondPart?.trim() || 'Unknown Artist';
      
      log('D:PARSDB', 'TX:016', `Parsed generic track: "${title}" by "${artist}"`);
      return { title, artist };
    });
  }
}
