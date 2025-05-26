import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import textract from 'textract';
import * as path from 'path';
import { log, logError } from '@uploadDistributor/logging';

const extractText = (filePath: string) => {
  return new Promise<string>((resolve, reject) => {
    textract.fromFileWithPath(filePath, {
      preserveLineBreaks: true,
      preserveOnlyMultipleLineBreaks: false
    }, (error: Error | null, text: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(text);
      }
    });
  });
};

export class TextractParser implements SonglistParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      // Log start of parsing
      log('D:PARSER', 'TX:001', `Starting to parse file: ${path.basename(filePath)}`);
      
      const textContent = await extractText(filePath);
      if (!textContent) {
        logError('ERROR   ', 'TX:002', `Failed to extract text from file: ${path.basename(filePath)}`);
        return {
          songs: [],
          error: ParseError.FILE_READ_ERROR
        };
      }
      
      log('D:PARSDB', 'TX:003', `Successfully extracted text, length: ${textContent.length}`);
      
      // Split into lines and find where tracks start
      const lines = textContent.split(/\r\n|\r|\n/);
      log('D:PARSDB', 'TX:004', `Split into ${lines.length} lines`);
      
      // Find where tracks start - either numbered lines or lines with artist-title delimiters
      const trackStartIndex = lines.findIndex((line: string, index: number) => {
        const trimmed = line.trim();
        // Skip empty lines and header lines
        if (!trimmed || index === 0 || trimmed.includes('TrackList') || trimmed.includes('Track List')) {
          return false;
        }
        return (
          /^\d+[\.\)]?\s/.test(trimmed) || // Numbered tracks
          /\s[-–]\s/.test(trimmed) || // Lines with hyphen or en dash delimiters
          /^[^,]+(,\s*[^,]+)*\s+[-–]\s/.test(trimmed) || // Artist(s) followed by delimiter
          /\s{2,}(?!featuring)/.test(trimmed) || // Two or more spaces (if not before "featuring")
          /\t+/.test(trimmed) || // One or more tabs
          /\s*,\s*/.test(trimmed) // Comma with optional spaces
        );
      });
      
      if (trackStartIndex === -1) {
        log('D:PARSER', 'TX:005', 'No track lines found in file');
        return {
          songs: [],
          error: ParseError.NO_TRACKS_DETECTED
        };
      }
      
      log('D:PARSDB', 'TX:006', `Track start index: ${trackStartIndex}`);
      
      // Get only the track lines
      const tracks = lines
        .slice(trackStartIndex)
        .map((line: string) => line.trim())
        .filter((line: string) => {
          const trimmed = line.trim();
          // Skip empty lines, headers, and file names
          if (!trimmed || 
              trimmed.includes('TrackList') || 
              trimmed.includes('Track List') ||
              trimmed.includes('.docx') ||
              trimmed.includes('.txt') ||
              trimmed.includes('.rtf')) {
            return false;
          }
          return true;
        });
      
      if (tracks.length === 0) {
        log('D:PARSER', 'TX:007', 'No valid track lines found after filtering');
        return {
          songs: [],
          error: ParseError.NO_TRACKS_DETECTED
        };
      }

      log('D:PARSDB', 'TX:008', `Found ${tracks.length} potential track lines`);

      const delimiters = [
        /\s+[-–]\s+/,          // Hyphen with spaces
        /\s{2,}(?!featuring)/,  // Two or more spaces (if not before "featuring")
        /\t+/,                  // One or more tabs
        /\s*,\s*/,             // Comma with optional spaces
        /(?<!\d)[-–](?![^(]*\))/ // Fallback: hyphen not in parentheses
      ];
      
      const songs = tracks.map((track: string) => {
        // Remove track numbers at start of line
        const cleanedTrack = track.replace(/^\d+[\.\)]?\s+/, '');
        
        log('D:PARSDB', 'TX:009', `Processing track: ${track}`);
        
        let title = cleanedTrack;
        let artist = 'Unknown Artist';

        for (const delimiter of delimiters) {
          log('D:PARSDB', 'TX:010', `Trying delimiter: ${delimiter}`);
          const attempt = cleanedTrack.split(delimiter)
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          const firstPart = attempt[0];
          if (attempt.length >= 2 && firstPart && !firstPart.match(/^\d+$/)) {
            log('D:PARSDB', 'TX:011', 'Found valid split');
            title = firstPart;
            const remainingParts = attempt.slice(1);
            if (remainingParts.length > 0) {
              artist = remainingParts.join(' - ');
            }
            break;
          }
        }
        
        const result = {
          title: title.trim(),
          artist: artist.trim()
        };
        log('D:PARSDB', 'TX:012', `Parsed track: "${result.title}" by "${result.artist}"`);
        return result;
      });
      
      if (songs.length === 0) {
        log('D:PARSER', 'TX:013', 'No valid songs extracted from track lines');
        return {
          songs: [],
          error: ParseError.NO_VALID_SONGS
        };
      }
      
      log('D:PARSER', 'TX:014', `Completed parsing, found ${songs.length} songs`);
      return {
        songs,
        error: ParseError.NONE
      };
      
    } catch (error) {
      logError('ERROR   ', 'TX:015', `Error parsing file: ${error}`);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
    }
  }
}
