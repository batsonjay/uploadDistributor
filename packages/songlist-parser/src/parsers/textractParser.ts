import { Song } from '../types.js';
import { SonglistParser } from './parser.js';
import textract from 'textract';
import { promisify } from 'util';

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
  async parse(filePath: string): Promise<Song[]> {
    try {
      const textContent = await extractText(filePath) as string;
      if (!textContent) {
        throw new Error('Failed to extract text from file');
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
          /^[^,]+(,\s*[^,]+)*\s+[-–]\s/.test(trimmed) // Artist(s) followed by delimiter
        );
      });
      
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
          return (
            (/^\d+[\.\)]?\s/.test(trimmed) || // Numbered tracks
             /\s[-–]\s/.test(trimmed) || // Lines with hyphen or en dash delimiters
             /^[^,]+(,\s*[^,]+)*\s+[-–]\s/.test(trimmed)) && // Artist(s) followed by delimiter
            line.length > 0
          );
        });
      const songs = tracks.map((track: string) => {
        // Remove track numbers at start of line
        const cleanedTrack = track.replace(/^\d+[\.\)]?\s+/, '');
        
        // Try each delimiter pattern in order
        const delimiters = [
          /\s+[-–]\s+/,          // Hyphen with spaces on both sides
          /\s+[-–]|[-–]\s+/,     // Hyphen with space on either side
          /(?<!\d\s*)[-–](?![^(]*\))(?!\d)/, // Bare hyphen (but not within parentheses and not after a number)
          /\s{3,}/,              // Multiple spaces (3 or more)
          /\t+/,                 // Tabs
          /(?<!\d)[-–](?![^(]*\))/ // Fallback: any hyphen not preceded by a number and not within parentheses
        ];
        
        // Try each delimiter until we find one that gives a valid split
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
      
      return songs;
    } catch (error: unknown) {
      process.stderr.write(`Error parsing file: ${error}\n`);
      throw error;
    }
  }
}
