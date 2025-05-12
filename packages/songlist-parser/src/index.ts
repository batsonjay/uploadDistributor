import { NMLParser } from './parsers/nmlParser';
import { TXTParser } from './parsers/txtParser';
import { Song } from './types';

function parseSonglist(filePath: string, format: string): Song[] {
  let parser;
  
  switch (format.toLowerCase()) {
    case 'nml':
      parser = new NMLParser();
      break;
    case 'txt':
      parser = new TXTParser();
      break;
    default:
      throw new Error(`Unsupported file format: ${format}`);
  }
  
  return parser.parse(filePath);
}

// Example usage
try {
  const songs = parseSonglist(
    process.argv[2] || '/Users/balearicfm/Projects/uploadDistributor/apps/tf/2025-05-09.nml',
    process.argv[3] || 'nml'
  );
  console.log('Parsed songs:', songs);
} catch (error: unknown) {
  if (error instanceof Error) {
    console.error('Error parsing songlist:', error.message);
  } else {
    console.error('Unknown error occurred while parsing songlist');
  }
}
