# Songlist Parsing Implementation Plan

## Overview
This document outlines the complete strategy for implementing songlist parsing functionality, including handling various file formats and providing user interaction features.

## 1. Create Standalone SonglistParser Module ✓
- Location: `packages/songlist-parser/`
- Structure:
  - `src/` - Core parsing logic ✓
- Responsibilities:
  - Detect file format ✓
  - Parse supported formats ✓
  - Normalize data structure ✓
  - Handle errors and validation ✓
- Integration:
  - Import as package in daemon and CLI ✓

Note: Originally planned standalone CLI interface has been deprecated in favor of using npx commands and test-parser.sh script.

## 2. Implement Format-Specific Parsers ✓
### NML Files ✓
- Parse XML structure
- Extract track metadata from <ENTRY> tags
- Map to standardized format

### RTF/TXT Files ✓
- Convert RTF to plain text
- Use pattern matching to identify track lines
- Handle title/artist order ambiguity with heuristics

### DOC/DOCX Files ✓
- Use textract library
- Extract text content
- Process similar to RTF/TXT

## 3. Normalization Logic ✓
- Remove leading/trailing whitespace
- Standardize track numbering (ignore existing numbers)
- Handle multiple tabs/spaces
- Detect and normalize title/artist order
- Validate required fields

## 4. User Interaction Features ✓
### Order Confirmation ✓
For non-NML files:
- Extract first title/artist pair
- Present to user with prompt:
  "Should title and artist be swapped? [y/N]"
- Apply user's selection to entire file

### Future: Editable Table Interface
- Present parsed data in a table format
- Columns: Track | Title
- Allow cell editing for corrections
- "Swap Track/Title" button to reverse all rows
- Validation indicators for malformed entries
- Save/Reset functionality

## 5. Implementation Status

### Phase 1: NML File Support ✓
1. Create SonglistParser module structure ✓
2. Implement NML parser ✓
3. Output normalized array of title/artist pairs ✓

### Phase 2: Basic TXT File Support ✓
1. Implement TXT file reader ✓
2. Add basic line parsing and cleanup ✓
3. Output normalized array assuming title/artist order ✓

### Phase 3: Additional File Formats ✓
1. Add RTF file support ✓
2. Implement DOC file parsing ✓
3. Add DOCX file handling ✓

### Phase 4: Rekordbox support ✓
1. Implement Rekordbox-specific parsing ✓

### Phase 5: TXT Order Verification ✓
1. Implement client-side user prompt to confirm title/artist order after initial parsing ✓
2. Implement order swapping functionality ✓
3. Update output to reflect correct order ✓

### Phase 6: Future Enhancements
1. Develop editable table interface
2. Add validation indicators
3. Add save/reset capabilities

Note: Testing strategy has been updated to focus on manual testing using test-parser.sh with real Rekordbox files from DJs. Issues will be handled ad-hoc based on actual usage patterns rather than implementing a formal test suite.

## 7. Error Handling ✓
- Clear error messages for unsupported formats ✓
- Validation feedback for malformed entries ✓
- Graceful handling of missing fields ✓
- Logging for debugging purposes ✓

Added error types:
- FILE_READ_ERROR: When file can't be read or parsed
- NO_TRACKS_DETECTED: When no valid track lines found
- NO_VALID_SONGS: When tracks found but no valid songs parsed
- UNKNOWN_ERROR: For unexpected errors
