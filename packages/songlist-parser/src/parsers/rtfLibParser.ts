import { Song } from '../types.js';
import { SonglistParser } from './parser.js';
import { readFile } from 'fs/promises';
import type { RTFDocument } from 'rtf-parser';

interface RTFDocumentWithMeta extends RTFDocument {
  type?: string;
  metadata?: any;
  fonts?: any[];
  colors?: any[];
  style?: {
    font: number;
    fontSize: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strikethrough: boolean;
    foreground: string | null;
    background: string | null;
    firstLineIndent: number;
    indent: number;
    align: string;
    valign: string;
  };
}

interface RTFGroupContent {
  content: RTFContent[];
}

type RTFContent = string | RTFGroupContent;
export class RTFLibParser implements SonglistParser {
  async parse(filePath: string): Promise<Song[]> {
    process.stdout.write('=== RTFLibParser.parse() START ===\n');
    process.stdout.write(`Reading file: ${filePath}\n`);
    const rtfBuffer = await readFile(filePath);  // Read as buffer
    process.stdout.write(`File read complete. Buffer length: ${rtfBuffer.length}\n`);
    process.stdout.write(`First 100 bytes: ${rtfBuffer.toString('utf8', 0, 100)}\n`);
    
    try {
      process.stdout.write('\n=== RTF Parsing Phase ===\n');
      
      // Import rtf-parser dynamically since we're in ES module
      const rtfParser = (await import('rtf-parser')).default;
      
      // Parse RTF content using Promise API
      process.stdout.write('1. Starting parse operation...\n');
      process.stdout.write('2. Calling rtfParser...\n');
      const rtfContent = rtfBuffer.toString();
      const doc = await rtfParser(rtfContent) as RTFDocumentWithMeta;
      
      process.stdout.write('3. Parser success, document structure:\n' + 
        JSON.stringify({
          contentLength: doc?.content?.length,
          fonts: doc?.fonts?.length,
          colors: doc?.colors?.length,
          style: doc?.style
        }, null, 2)
      );
      
      // Log the full document structure to understand what we're getting
      process.stdout.write(`RTF parsing successful, full doc: ${JSON.stringify(doc, null, 2)}\n`);
      
      process.stdout.write('\n=== Text Extraction Phase ===\n');
      // Extract text content from RTF document
      const textContent = this.extractText(doc);
      if (!textContent) {
        throw new Error('Failed to extract text from RTF document');
      }
      process.stdout.write(`Raw extracted text: ${textContent}\n`);
      
      process.stdout.write('\n=== Track Parsing Phase ===\n');
      // Split into lines and find where tracks start
      const lines = textContent.split(/\r\n|\r|\n/);
      process.stdout.write(`Split into lines: ${JSON.stringify(lines, null, 2)}\n`);
      const trackStartIndex = lines.findIndex((line: string) => /^\d+[\.\)]?\s/.test(line));
      
      process.stdout.write(`Track start index: ${trackStartIndex}\n`);
      
      // Get only the track lines
      const tracks = lines
        .slice(trackStartIndex)
        .map((line: string) => {
          const trimmed = line.trim();
          process.stdout.write(`Processing line: ${trimmed}\n`);
          return trimmed;
        })
        .filter((line: string) => {
          const isTrack = /^\d+[\.\)]?\s/.test(line) && line.length > 0;
          process.stdout.write(`Line is track? ${isTrack} : ${line}\n`);
          return isTrack;
        });

      process.stdout.write(`Tracks after splitting: ${JSON.stringify(tracks, null, 2)}\n`);
      
      process.stdout.write('\n=== Track Processing Results ===\n');
      process.stdout.write(`Found tracks: ${JSON.stringify(tracks, null, 2)}\n`);
      
      process.stdout.write('\n=== Artist/Title Extraction ===\n');
      const songs = tracks.map((track: string) => {
        // Remove track numbers at start of line
        const cleanedTrack = track.replace(/^\d+[\.\)]?\s+/, '');
        
        process.stdout.write(`\nProcessing track: ${track}\n`);
        // Try each delimiter pattern in order
        const delimiters = [
          // Hyphen with spaces on both sides
          /\s+[-–]\s+/,
          // Hyphen with space on either side
          /\s+[-–]|[-–]\s+/,
          // Bare hyphen (but not within parentheses and not after a number)
          /(?<!\d\s*)[-–](?![^(]*\))(?!\d)/,
          // Multiple spaces (3 or more)
          /\s{3,}/,
          // Tabs
          /\t+/,
          // Fallback: any hyphen not preceded by a number and not within parentheses
          /(?<!\d)[-–](?![^(]*\))/
        ];
        
        process.stdout.write(`Cleaned track: ${cleanedTrack}\n`);
        
        // Try each delimiter until we find one that gives a valid split
        let title = cleanedTrack;
        let artist = 'Unknown Artist';

        for (const delimiter of delimiters) {
          process.stdout.write(`Trying delimiter: ${delimiter}\n`);
          const attempt = cleanedTrack.split(delimiter)
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          process.stdout.write(`Split attempt: ${JSON.stringify(attempt, null, 2)}\n`);
          // Check if we have a valid split with non-empty parts
          const firstPart = attempt[0];
          if (attempt.length >= 2 && firstPart && !firstPart.match(/^\d+$/)) {
            process.stdout.write('Found valid split!\n');
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
        process.stdout.write(`Final result: ${JSON.stringify(result, null, 2)}\n`);
        return result;
      });
      
      process.stdout.write('\n=== Final Results ===\n');
      process.stdout.write(`Parsed songs: ${JSON.stringify(songs, null, 2)}\n`);
      process.stdout.write('=== RTFLibParser.parse() END ===\n\n');
      
      return songs;
    } catch (error: unknown) {
      process.stderr.write(`Error parsing RTF: ${error}\n`);
      process.stderr.write(`RTF content that failed: ${rtfBuffer.toString('hex')}\n`);
      throw error;
    }
  }

  private extractText(doc: RTFDocumentWithMeta): string {
    let text = '';
    
    // Helper function to recursively extract text from RTF document
    const extractFromGroup = (group: RTFDocument | RTFGroupContent) => {
      if ('content' in group) {
        for (const item of group.content) {
          if (typeof item === 'string') {
            text += item;
          } else if (typeof item === 'object' && 'content' in item) {
            extractFromGroup(item);
          }
        }
      }
      // Add newline after groups to preserve structure
      text += '\n';
    };
    
    extractFromGroup(doc);
    
    // Clean up the extracted text
    return text
      .replace(/\n+/g, '\n')  // Replace multiple newlines with single
      .trim();
  }
}
