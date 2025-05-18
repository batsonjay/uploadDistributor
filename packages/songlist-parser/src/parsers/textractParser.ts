import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import textract from 'textract';
import { logParserEvent, ParserLogType } from '../utils/LoggingUtils.js';
import * as path from 'path';

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
      logParserEvent('TextractParser', ParserLogType.INFO, `Starting to parse file: ${path.basename(filePath)}`);
      
      const textContent = await extractText(filePath);
      if (!textContent) {
        logParserEvent('TextractParser', ParserLogType.ERROR, `Failed to extract text from file: ${path.basename(filePath)}`);
        return {
          songs: [],
          error: ParseError.FILE_READ_ERROR
        };
      }
      
      logParserEvent('TextractParser', ParserLogType.DEBUG, `Successfully extracted text, length: ${textContent.length}`);
      
      // Split into lines and find where tracks start
      const lines = textContent.split(/\r\n|\r|\n/);
      logParserEvent('TextractParser', ParserLogType.DEBUG, `Split into ${lines.length} lines`);
      
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
        logParserEvent('TextractParser', ParserLogType.WARNING, 'No track lines found in file');
        return {
          songs: [],
          error: ParseError.NO_TRACKS_DETECTED
        };
      }
      
      logParserEvent('TextractParser', ParserLogType.DEBUG, `Track start index: ${trackStartIndex}`);
      
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
        logParserEvent('TextractParser', ParserLogType.WARNING, 'No valid track lines found after filtering');
        return {
          songs: [],
          error: ParseError.NO_TRACKS_DETECTED
        };
      }

      logParserEvent('TextractParser', ParserLogType.DEBUG, `Found ${tracks.length} potential track lines`);

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
        
        logParserEvent('TextractParser', ParserLogType.DEBUG, `Processing track: ${track}`);
        
        let title = cleanedTrack;
        let artist = 'Unknown Artist';

        for (const delimiter of delimiters) {
          logParserEvent('TextractParser', ParserLogType.DEBUG, `Trying delimiter: ${delimiter}`);
          const attempt = cleanedTrack.split(delimiter)
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          const firstPart = attempt[0];
          if (attempt.length >= 2 && firstPart && !firstPart.match(/^\d+$/)) {
            logParserEvent('TextractParser', ParserLogType.DEBUG, 'Found valid split');
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
        logParserEvent('TextractParser', ParserLogType.DEBUG, `Parsed track: "${result.title}" by "${result.artist}"`);
        return result;
      });
      
      if (songs.length === 0) {
        logParserEvent('TextractParser', ParserLogType.WARNING, 'No valid songs extracted from track lines');
        return {
          songs: [],
          error: ParseError.NO_VALID_SONGS
        };
      }
      
      logParserEvent('TextractParser', ParserLogType.INFO, `Completed parsing, found ${songs.length} songs`);
      return {
        songs,
        error: ParseError.NONE
      };
      
    } catch (error) {
      logParserEvent('TextractParser', ParserLogType.ERROR, `Error parsing file: ${error}`);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
    }
  }
}
