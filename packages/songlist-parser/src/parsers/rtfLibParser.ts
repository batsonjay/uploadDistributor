import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import { readFile } from 'fs/promises';
import type { RTFDocument } from 'rtf-parser';
import * as path from 'path';
import { log, logError } from '@uploadDistributor/logging';

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
  async parse(filePath: string): Promise<ParseResult> {
    log('D:PARSER', 'RTF:001', `Starting to parse file: ${path.basename(filePath)}`);
    
    try {
      const rtfBuffer = await readFile(filePath);  // Read as buffer
      log('D:PARSDB', 'RTF:002', `File read complete. Buffer length: ${rtfBuffer.length}`);
      log('D:PARSDB', 'RTF:003', `First 100 bytes: ${rtfBuffer.toString('utf8', 0, 100)}`);
      
      log('D:PARSDB', 'RTF:004', 'Starting RTF parsing phase');
      
      // Import rtf-parser dynamically since we're in ES module
      const rtfParser = (await import('rtf-parser')).default;
      
      // Parse RTF content using Promise API
      log('D:PARSDB', 'RTF:005', 'Starting parse operation');
      log('D:PARSDB', 'RTF:006', 'Calling rtfParser');
      const rtfContent = rtfBuffer.toString();
      const doc = await rtfParser(rtfContent) as RTFDocumentWithMeta;
      
      if (!doc) {
        logError('ERROR   ', 'RTF:007', 'RTF parser returned null document');
        return {
          songs: [],
          error: ParseError.FILE_READ_ERROR
        };
      }
      
      log('D:PARSDB', 'RTF:008', 'Parser success, document structure: ' + 
        JSON.stringify({
          contentLength: doc.content?.length,
          fonts: doc.fonts?.length,
          colors: doc.colors?.length,
          style: doc.style
        }, null, 2)
      );
      
      log('D:PARSDB', 'RTF:009', 'Starting text extraction phase');
      // Extract text content from RTF document
      const textContent = this.extractText(doc);
      if (!textContent) {
        logError('ERROR   ', 'RTF:010', 'Failed to extract text from RTF document');
        return {
          songs: [],
          error: ParseError.FILE_READ_ERROR
        };
      }
      log('D:PARSDB', 'RTF:011', `Raw extracted text: ${textContent}`);
      
      log('D:PARSDB', 'RTF:012', 'Starting track parsing phase');
      // Split into lines and find where tracks start
      const lines = textContent.split(/\r\n|\r|\n/);
      log('D:PARSDB', 'RTF:013', `Split into ${lines.length} lines`);
      const trackStartIndex = lines.findIndex((line: string) => /^\d+[\.\)]?\s/.test(line));
      
      if (trackStartIndex === -1) {
        log('D:PARSER', 'RTF:014', 'No track lines found in RTF file');
        return {
          songs: [],
          error: ParseError.NO_TRACKS_DETECTED
        };
      }
      
      log('D:PARSDB', 'RTF:015', `Track start index: ${trackStartIndex}`);
      
      // Get only the track lines
      const tracks = lines
        .slice(trackStartIndex)
        .map((line: string) => {
          const trimmed = line.trim();
          log('D:PARSDB', 'RTF:016', `Processing line: ${trimmed}`);
          return trimmed;
        })
        .filter((line: string) => {
          const isTrack = /^\d+[\.\)]?\s/.test(line) && line.length > 0;
          log('D:PARSDB', 'RTF:017', `Line is track? ${isTrack} : ${line}`);
          return isTrack;
        });

      if (tracks.length === 0) {
        log('D:PARSER', 'RTF:018', 'No valid track lines found after filtering');
        return {
          songs: [],
          error: ParseError.NO_TRACKS_DETECTED
        };
      }

      log('D:PARSDB', 'RTF:019', `Found ${tracks.length} track lines`);
      
      log('D:PARSDB', 'RTF:020', 'Starting artist/title extraction');
      const songs = tracks.map((track: string) => {
        // Remove track numbers at start of line
        const cleanedTrack = track.replace(/^\d+[\.\)]?\s+/, '');
        
        log('D:PARSDB', 'RTF:021', `Processing track: ${track}`);
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
        
        log('D:PARSDB', 'RTF:022', `Cleaned track: ${cleanedTrack}`);
        
        // Try each delimiter until we find one that gives a valid split
        let title = cleanedTrack;
        let artist = 'Unknown Artist';

        for (const delimiter of delimiters) {
          log('D:PARSDB', 'RTF:023', `Trying delimiter: ${delimiter}`);
          const attempt = cleanedTrack.split(delimiter)
            .map(p => p.trim())
            .filter(p => p.length > 0);
          
          log('D:PARSDB', 'RTF:024', `Split attempt: ${JSON.stringify(attempt)}`);
          // Check if we have a valid split with non-empty parts
          const firstPart = attempt[0];
          if (attempt.length >= 2 && firstPart && !firstPart.match(/^\d+$/)) {
            log('D:PARSDB', 'RTF:025', 'Found valid split');
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
        log('D:PARSDB', 'RTF:026', `Parsed track: "${result.title}" by "${result.artist}"`);
        return result;
      });
      
      log('D:PARSER', 'RTF:027', `Completed parsing, found ${songs.length} songs`);
      
      return {
        songs,
        error: songs.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
      };
      
    } catch (error: unknown) {
      logError('ERROR   ', 'RTF:028', `Error parsing RTF: ${error}`);
      if (error instanceof Error) {
        logError('ERROR   ', 'RTF:029', `Error details: ${error.message}`);
      }
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
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
