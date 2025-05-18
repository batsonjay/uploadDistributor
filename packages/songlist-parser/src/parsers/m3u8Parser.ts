import { Song, ParseResult, ParseError } from '../types.js';
import { SonglistParser } from './parser.js';
import { readFile } from 'fs/promises';

export class M3U8Parser implements SonglistParser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      // Read the file content
      const content = await readFile(filePath, 'utf8');
      console.log(`M3U8Parser: Read file content, length: ${content.length}`);
      
      // Split into lines
      const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      console.log(`M3U8Parser: Split into ${lines.length} lines`);
      console.log(`M3U8Parser: First few lines: ${lines.slice(0, 3).join('\n')}`);
      
      // Check if this is a valid M3U8 file
      if (!lines[0]?.startsWith('#EXTM3U')) {
        console.log(`M3U8Parser: Not a valid M3U8 file, first line: ${lines[0]}`);
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
          console.log(`M3U8Parser: Found EXTINF line: ${currentLine}`);
          
          // Extract the metadata part after the duration and first comma
          // Format is typically: #EXTINF:duration,Artist - Title
          // But sometimes: #EXTINF:duration,Artist1, Artist2 - Title
          const firstCommaIndex = currentLine.indexOf(',');
          
          if (firstCommaIndex > 0) {
            // Get everything after the first comma
            const fullMetadata = currentLine.substring(firstCommaIndex + 1).trim();
            console.log(`M3U8Parser: Full metadata: ${fullMetadata}`);
            
            // Find the dash separator
            const dashIndex = fullMetadata.indexOf(' - ');
            
            if (dashIndex > 0) {
              // We have a standard "Artist - Title" format
              const artistPart = fullMetadata.substring(0, dashIndex).trim();
              const titlePart = fullMetadata.substring(dashIndex + 3).trim();
              
              console.log(`M3U8Parser: Found dash separator at index ${dashIndex}`);
              console.log(`M3U8Parser: Artist part: "${artistPart}", Title part: "${titlePart}"`);
              
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
                
                console.log(`M3U8Parser: Found alt dash separator at index ${altDashIndex}`);
                console.log(`M3U8Parser: Artist part: "${artistPart}", Title part: "${titlePart}"`);
                
                songs.push({
                  artist: artistPart || 'Unknown Artist',
                  title: titlePart || 'Unknown Title'
                });
              } else {
                // No dash separator found, use the whole string as title
                console.log(`M3U8Parser: No separator found, using full text as title`);
                songs.push({
                  title: fullMetadata || 'Unknown Title',
                  artist: 'Unknown Artist'
                });
              }
            }
          }
        }
      }
      
      console.log(`M3U8Parser: Parsed ${songs.length} songs`);
      return {
        songs,
        error: songs.length > 0 ? ParseError.NONE : ParseError.NO_VALID_SONGS
      };
    } catch (error) {
      console.error(`Error parsing M3U8 file: ${error}`);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR
      };
    }
  }
  
  private parseMetadata(metadataText: string | undefined): Song {
    console.log(`M3U8Parser.parseMetadata: Processing metadata: "${metadataText || ''}"`);
    
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
      
      console.log(`M3U8Parser.parseMetadata: Found dash separator at index ${dashIndex}`);
      console.log(`M3U8Parser.parseMetadata: Artist part: "${artistPart}", Title part: "${titlePart}"`);
      
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
      
      console.log(`M3U8Parser.parseMetadata: Found alt dash separator at index ${altDashIndex}`);
      console.log(`M3U8Parser.parseMetadata: Artist part: "${artistPart}", Title part: "${titlePart}"`);
      
      return {
        artist: artistPart || 'Unknown Artist',
        title: titlePart || 'Unknown Title'
      };
    }
    
    // Fallback if no separator found
    console.log(`M3U8Parser.parseMetadata: No separator found, using full text as title`);
    return {
      title: fullMetadata || 'Unknown Title',
      artist: 'Unknown Artist'
    };
  }
}
