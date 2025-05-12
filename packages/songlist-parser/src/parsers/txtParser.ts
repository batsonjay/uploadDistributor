import { Song } from '../types.js';
import { SonglistParser } from './parser.js';
import { readFile } from 'fs/promises';

export class TXTParser implements SonglistParser {
  async parse(filePath: string): Promise<Song[]> {
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
      
      // For Phase 2, just return the parts as-is without determining order
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
