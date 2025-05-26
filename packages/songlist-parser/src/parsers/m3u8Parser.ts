import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import { readFile } from 'fs/promises';
import * as path from 'path';
import { log, logError } from '@uploadDistributor/logging';

export class M3U8Parser implements SonglistParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      // Log start of parsing
      log('D:PARSER', 'M3U:001', `Starting to parse file: ${path.basename(filePath)}`);
      
      // Read the file content
      const content = await readFile(filePath, 'utf8');
      log('D:PARSER', 'M3U:002', `Read file content, length: ${content.length}`);
      
      // Split into lines
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      log('D:PARSER', 'M3U:003', `Split into ${lines.length} lines`);
      log('D:PARSDB', 'M3U:004', `First few lines: ${lines.slice(0, 3).join('\n')}`);
      
      // Check if this is a valid M3U8 file
      if (!lines[0]?.startsWith('#EXTM3U')) {
        log('D:PARSER', 'M3U:005', `Not a valid M3U8 file, first line: ${lines[0]}`);
        return {
          songs: [],
          error: ParseError.FILE_READ_ERROR
        };
      }
      
      const songs: Song[] = [];
      
      // Process lines to find EXTINF entries
      for (let i = 0; i < lines.length; i++) {
        const currentLine = lines[i];
        
        // Check if this is an EXTINF line
        if (currentLine && currentLine.startsWith('#EXTINF:')) {
          log('D:PARSDB', 'M3U:006', `Found EXTINF line: ${currentLine}`);
          
          // Extract the metadata part after the duration and first comma
          // Format is typically: #EXTINF:duration,Artist - Title
          // But sometimes: #EXTINF:duration,Artist1, Artist2 - Title
          const firstCommaIndex = currentLine.indexOf(',');
          
          if (firstCommaIndex > 0) {
            // Get everything after the first comma
            const fullMetadata = currentLine.substring(firstCommaIndex + 1).trim();
            log('D:PARSDB', 'M3U:007', `Full metadata: ${fullMetadata}`);
            
            // Find the dash separator
            const dashIndex = fullMetadata.indexOf(' - ');
            
            if (dashIndex > 0) {
              // We have a standard "Artist - Title" format
              const artistPart = fullMetadata.substring(0, dashIndex).trim();
              const titlePart = fullMetadata.substring(dashIndex + 3).trim();
              
              log('D:PARSDB', 'M3U:008', `Found dash separator at index ${dashIndex}`);
              log('D:PARSDB', 'M3U:009', `Artist part: "${artistPart}", Title part: "${titlePart}"`);
              
              songs.push({
                artist: artistPart || 'Unknown Artist',
                title: titlePart || 'Unknown Title'
              });
            } else {
              // Try alternative dash
              const altDashIndex = fullMetadata.indexOf(' – ');
              
              if (altDashIndex > 0) {
                const artistPart = fullMetadata.substring(0, altDashIndex).trim();
                const titlePart = fullMetadata.substring(altDashIndex + 3).trim();
                
                log('D:PARSDB', 'M3U:010', `Found alt dash separator at index ${altDashIndex}`);
                log('D:PARSDB', 'M3U:011', `Artist part: "${artistPart}", Title part: "${titlePart}"`);
                
                songs.push({
                  artist: artistPart || 'Unknown Artist',
                  title: titlePart || 'Unknown Title'
                });
              } else {
                // No dash separator found, use the whole string as title
                log('D:PARSER', 'M3U:012', `No separator found, using full text as title`);
                songs.push({
                  title: fullMetadata || 'Unknown Title',
                  artist: 'Unknown Artist'
                });
              }
            }
          }
        }
      }
      
      log('D:PARSER', 'M3U:013', `Completed parsing, found ${songs.length} songs`);
      return {
        songs,
        error: songs.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
      };
    } catch (error) {
      logError('ERROR   ', 'M3U:014', `Error parsing M3U8 file: ${error}`);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
    }
  }
  
  private parseMetadata(metadataText: string | undefined): Song {
    log('D:PARSDB', 'M3U:015', `Processing metadata: "${metadataText || ''}"`);
    
    if (!metadataText) {
      return {
        title: 'Unknown Title',
        artist: 'Unknown Artist'
      };
    }
    
    // Handle cases with commas in artist names
    // First check if the format is like "Artist1, Artist2 - Title"
    const fullMetadata = metadataText.trim();
    const dashIndex = fullMetadata.indexOf(' - ');
    
    if (dashIndex > 0) {
      const artistPart = fullMetadata.substring(0, dashIndex).trim();
      const titlePart = fullMetadata.substring(dashIndex + 3).trim();
      
      log('D:PARSDB', 'M3U:016', `Found dash separator at index ${dashIndex}`);
      log('D:PARSDB', 'M3U:017', `Artist part: "${artistPart}", Title part: "${titlePart}"`);
      
      return {
        artist: artistPart || 'Unknown Artist',
        title: titlePart || 'Unknown Title'
      };
    }
    
    // Try alternative dash
    const altDashIndex = fullMetadata.indexOf(' – ');
    if (altDashIndex > 0) {
      const artistPart = fullMetadata.substring(0, altDashIndex).trim();
      const titlePart = fullMetadata.substring(altDashIndex + 3).trim();
      
      log('D:PARSDB', 'M3U:018', `Found alt dash separator at index ${altDashIndex}`);
      log('D:PARSDB', 'M3U:019', `Artist part: "${artistPart}", Title part: "${titlePart}"`);
      
      return {
        artist: artistPart || 'Unknown Artist',
        title: titlePart || 'Unknown Title'
      };
    }
    
    // Fallback if no separator found
    log('D:PARSER', 'M3U:020', `No separator found, using full text as title`);
    return {
      title: fullMetadata || 'Unknown Title',
      artist: 'Unknown Artist'
    };
  }
}
