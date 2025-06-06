# Parser Implementation

This document details the architecture and implementation of the songlist parsing system in the Upload Distributor project.

## Architecture Overview

The songlist parsing system is designed with modularity and extensibility in mind. It consists of:

1. **Core Parser Interface**: Defines the common interface that all format-specific parsers must implement
2. **Format-Specific Parsers**: Individual parsers for each supported file format
3. **Parser Factory**: Detects file format and routes to the appropriate parser
4. **Normalization Layer**: Standardizes output across all parsers
5. **Error Handling**: Consistent error reporting across all parsers
6. **Logging System**: Standardized logging across all parsers

## Parser Interface

All parsers implement a common interface defined in `packages/songlist-parser/src/parsers/parser.ts`:

```typescript
export interface Parser {
  parse(filePath: string): Promise<ParseResult>;
}
```

The `ParseResult` type includes:
- Parsed songs (array of title/artist pairs)
- Error information
- Additional metadata

## Supported File Formats

### NML Files (.nml)
- Generated by Traktor Pro DJ software
- XML-based format
- Parsing strategy: XML parsing with xml2js
- Track information extracted from `<ENTRY>` tags

### RTF Files (.rtf)
- Rich Text Format files
- Parsing strategy: Convert to plain text using rtf-parser
- Line-by-line analysis with regex patterns

### Text Files (.txt)
- Plain text files
- Parsing strategy: Line-by-line analysis with regex patterns
- Handles various formatting styles

### Word Documents (.doc, .docx)
- Microsoft Word documents
- Parsing strategy: Extract text using textract library
- Process extracted text similar to plain text files

### M3U8 Playlists (.m3u8)
- Standard playlist format used by many DJ applications including Rekordbox
- Parsing strategy: Extract metadata from EXTINF lines
- Artist/title separation based on dash character

## Format Detection and Routing

The system detects file formats based on file extension and routes to the appropriate parser:

1. File extension is extracted from the path
2. The appropriate parser is selected based on the extension
3. If no specific parser is available for the extension, falls back to text-based parsing

This routing logic is implemented in the main `parseSonglist` function in `packages/songlist-parser/src/index.ts`.

## Normalization Process

All parsers normalize their output to a consistent format:

1. Remove leading/trailing whitespace
2. Standardize track numbering (ignore existing numbers)
3. Handle multiple tabs/spaces
4. Detect and normalize title/artist order
5. Validate required fields

## Error Handling

The system uses a standardized error reporting mechanism:

```typescript
export enum ParseError {
  NONE = 'NONE',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  NO_TRACKS_DETECTED = 'NO_TRACKS_DETECTED',
  NO_VALID_SONGS = 'NO_VALID_SONGS',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
```

Each parser reports errors using this enum, ensuring consistent error handling across the system.

## Logging System

The parser system now includes a standardized logging mechanism implemented in `packages/songlist-parser/src/utils/LoggingUtils.ts`:

```typescript
export enum ParserLogType {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  DEBUG = 'debug'
}

export function logParserEvent(
  parserName: string,
  eventType: ParserLogType,
  message: string,
  details?: any
): void {
  // Logging implementation
}
```

This logging system:
- Provides consistent logging across all parsers
- Supports different log levels (ERROR, WARNING, INFO, DEBUG)
- Respects environment-based log level configuration
- Includes timestamps and parser identification
- Filters logs based on configured log level

All parsers have been updated to use this logging system instead of direct console.log calls, improving debugging capabilities and consistency.

## Adding a New Parser

To add support for a new file format:

1. Create a new parser file in `packages/songlist-parser/src/parsers/`
2. Implement the Parser interface
3. Add the new parser to the exports in `packages/songlist-parser/src/index.ts`
4. Update the format detection logic to route to the new parser
5. Use the standardized logging system for all logging needs

Example implementation pattern:

```typescript
import { Parser, ParseResult, ParseError } from './parser';
import { logParserEvent, ParserLogType } from '../utils/LoggingUtils';

export class NewFormatParser implements Parser {
  async parse(filePath: string): Promise<ParseResult> {
    try {
      logParserEvent('NewFormatParser', ParserLogType.INFO, `Starting to parse file: ${path.basename(filePath)}`);
      
      // Format-specific parsing logic
      
      logParserEvent('NewFormatParser', ParserLogType.INFO, `Completed parsing, found ${parsedSongs.length} songs`);
      return {
        songs: parsedSongs,
        error: ParseError.NONE
      };
    } catch (err) {
      logParserEvent('NewFormatParser', ParserLogType.ERROR, `Error parsing file: ${err}`);
      return {
        songs: [],
        error: ParseError.UNKNOWN_ERROR,
        errorMessage: err.message
      };
    }
  }
}
```

## Integration with Daemon

The parser system is integrated with the daemon through:

1. **SonglistParserService**: A wrapper service that provides parsing functionality to the daemon
2. **parse-songlist Endpoint**: API endpoint for parsing songlist files
3. **File Processor**: Background processing of uploaded files

## Testing Strategy

The parser system is tested through:

1. **Manual Testing**: Using real-world files from DJs
2. **Test Files**: Sample files in `apps/tf/` directory
3. **Integration Testing**: Testing through the main upload flow

## Future Enhancements

Planned enhancements to the parser system:

1. ✅ **Unified Logging System**: Implemented standardized logging across all parsers
2. **Editable Table Interface**: Allow users to edit parsed data
3. **Validation Indicators**: Visual feedback for malformed entries
4. **Save/Reset Capabilities**: Allow users to save changes or reset to original parsing
5. **Additional Format Support**: Add support for more file formats as needed
6. **Unified Execution Path**: Standardize the handling of all file types
7. **Consistent Storage Location**: Review and standardize where parsed songlists are stored
