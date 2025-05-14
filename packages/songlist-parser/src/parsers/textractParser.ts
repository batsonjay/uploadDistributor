import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import textract from 'textract';

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
      const textContent = await extractText(filePath);
      if (!textContent) {
        return {
          songs: [],
          error: ParseError.FILE_READ_ERROR
        };
      }
      
      // Split into lines and find where tracks start
      const lines = textContent.split(/\r\n|\r|\n/);
      
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
        return {
          songs: [],
          error: ParseError.NO_TRACKS_DETECTED
        };
      }
      
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
        return {
          songs: [],
          error: ParseError.NO_TRACKS_DETECTED
        };
      }

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
        
        let title = cleanedTrack;
        let artist = 'Unknown Artist';

        for (const delimiter of delimiters) {
          const attempt = cleanedTrack.split(delimiter)
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          const firstPart = attempt[0];
          if (attempt.length >= 2 && firstPart && !firstPart.match(/^\d+$/)) {
            title = firstPart;
            const remainingParts = attempt.slice(1);
            if (remainingParts.length > 0) {
              artist = remainingParts.join(' - ');
            }
            break;
          }
        }
        
        return {
          title: title.trim(),
          artist: artist.trim()
        };
      });
      
      if (songs.length === 0) {
        return {
          songs: [],
          error: ParseError.NO_VALID_SONGS
        };
      }
      
      return {
        songs,
        error: ParseError.NONE
      };
      
    } catch (error) {
      console.error(`Error parsing file: ${error}`);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
    }
  }
}
