import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import { readFile } from 'fs/promises';
import { logParserEvent, ParserLogType } from '../utils/LoggingUtils.js';
import * as path from 'path';

export class M3U8Parser implements SonglistParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      // Log start of parsing
      logParserEvent('M3U8Parser', ParserLogType.INFO, `Starting to parse file: ${path.basename(filePath)}`);
      
      // Read the file content
      const content = await readFile(filePath, 'utf8');
      logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Read file content, length: ${content.length}`);
      
      // Split into lines
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Split into ${lines.length} lines`);
      logParserEvent('M3U8Parser', ParserLogType.DEBUG, `First few lines: ${lines.slice(0, 3).join('\n')}`);
      
      // Check if this is a valid M3U8 file
      if (!lines[0]?.startsWith('#EXTM3U')) {
        logParserEvent('M3U8Parser', ParserLogType.WARNING, `Not a valid M3U8 file, first line: ${lines[0]}`);
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
          logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Found EXTINF line: ${currentLine}`);
          
          // Extract the metadata part after the duration and first comma
          // Format is typically: #EXTINF:duration,Artist - Title
          // But sometimes: #EXTINF:duration,Artist1, Artist2 - Title
          const firstCommaIndex = currentLine.indexOf(',');
          
          if (firstCommaIndex > 0) {
            // Get everything after the first comma
            const fullMetadata = currentLine.substring(firstCommaIndex + 1).trim();
            logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Full metadata: ${fullMetadata}`);
            
            // Find the dash separator
            const dashIndex = fullMetadata.indexOf(' - ');
            
            if (dashIndex > 0) {
              // We have a standard "Artist - Title" format
              const artistPart = fullMetadata.substring(0, dashIndex).trim();
              const titlePart = fullMetadata.substring(dashIndex + 3).trim();
              
              logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Found dash separator at index ${dashIndex}`);
              logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Artist part: "${artistPart}", Title part: "${titlePart}"`);
              
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
                
                logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Found alt dash separator at index ${altDashIndex}`);
                logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Artist part: "${artistPart}", Title part: "${titlePart}"`);
                
                songs.push({
                  artist: artistPart || 'Unknown Artist',
                  title: titlePart || 'Unknown Title'
                });
              } else {
                // No dash separator found, use the whole string as title
                logParserEvent('M3U8Parser', ParserLogType.WARNING, `No separator found, using full text as title`);
                songs.push({
                  title: fullMetadata || 'Unknown Title',
                  artist: 'Unknown Artist'
                });
              }
            }
          }
        }
      }
      
      logParserEvent('M3U8Parser', ParserLogType.INFO, `Completed parsing, found ${songs.length} songs`);
      return {
        songs,
        error: songs.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
      };
    } catch (error) {
      logParserEvent('M3U8Parser', ParserLogType.ERROR, `Error parsing M3U8 file: ${error}`);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
    }
  }
  
  private parseMetadata(metadataText: string | undefined): Song {
    logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Processing metadata: "${metadataText || ''}"`);
    
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
      
      logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Found dash separator at index ${dashIndex}`);
      logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Artist part: "${artistPart}", Title part: "${titlePart}"`);
      
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
      
      logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Found alt dash separator at index ${altDashIndex}`);
      logParserEvent('M3U8Parser', ParserLogType.DEBUG, `Artist part: "${artistPart}", Title part: "${titlePart}"`);
      
      return {
        artist: artistPart || 'Unknown Artist',
        title: titlePart || 'Unknown Title'
      };
    }
    
    // Fallback if no separator found
    logParserEvent('M3U8Parser', ParserLogType.WARNING, `No separator found, using full text as title`);
    return {
      title: fullMetadata || 'Unknown Title',
      artist: 'Unknown Artist'
    };
  }
}
