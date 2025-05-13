# Songlist Parsing Implementation Plan

## Overview
This document outlines the complete strategy for implementing songlist parsing functionality, including handling various file formats and providing user interaction features.

## 1. Create Standalone SonglistParser Module
- Location: `packages/songlist-parser/`
- Structure:
  - `src/` - Core parsing logic
  - `bin/` - CLI interface for standalone use
  - `test/` - Unit and integration tests
- Responsibilities:
  - Detect file format
  - Parse supported formats
  - Normalize data structure
  - Handle errors and validation
- Standalone Usage:
  - Install as separate package: `npm install -g @uploadDistributor/songlist-parser`
  - CLI command: `songlist-parser process <file>`
  - Outputs standardized JSON
- Integration:
  - Import as package in daemon and CLI
  - Use same core logic for consistency

## 2. Implement Format-Specific Parsers
### NML Files
- Parse XML structure
- Extract track metadata from <ENTRY> tags
- Map to standardized format

### RTF/TXT Files
- Convert RTF to plain text
- Use pattern matching to identify track lines
- Handle title/artist order ambiguity with heuristics

### DOC/DOCX Files
- Use library like mammoth or docxtract
- Extract text content
- Process similar to RTF/TXT

## 3. Normalization Logic
- Remove leading/trailing whitespace
- Standardize track numbering (ignore existing numbers)
- Handle multiple tabs/spaces
- Detect and normalize title/artist order
- Validate required fields

## 4. User Interaction Features
### Order Confirmation
For non-NML files:
- Extract first title/artist pair
- Present to user with prompt:
  "Is this in [track/title] or [title/track] order?"
- Apply user's selection to entire file

### Future: Editable Table Interface
- Present parsed data in a table format
- Columns: Track | Title
- Allow cell editing for corrections
- "Swap Track/Title" button to reverse all rows
- Validation indicators for malformed entries
- Save/Reset functionality

## 5. Implementation Plan

### Phase 1: NML File Support
1. Create SonglistParser module structure
2. Implement NML parser
3. Output normalized array of title/artist pairs
4. Add unit tests for NML parsing

### Phase 2: Basic TXT File Support
1. Implement TXT file reader
2. Add basic line parsing and cleanup
3. Output normalized array assuming title/artist order
4. Add unit tests for TXT parsing

### Phase 3: Additional File Formats
1. Add RTF file support
2. Implement DOC file parsing
3. Add DOCX file handling
4. Add unit tests for each new format

### Phase 4: Rekordbox support
1. Implement Rekordbox-specific parsing
2. Add unit test for new format

### Phase 5: TXT Order Verification
1. Implement client-side user prompt to confirm title/artist order after initial parsing
2. Implement order swapping functionality
3. Update output to reflect correct order
4. Add unit tests for order handling


### Phase 6: Future Enhancements
1. Develop editable table interface
2. Add "Swap All" functionality
3. Implement validation indicators
4. Add save/reset capabilities

## 6. Testing Strategy
- Unit tests for each parser
- Integration tests for full workflow
- Edge case testing for various formats
- User acceptance testing for interface

## 7. Error Handling
- Clear error messages for unsupported formats
- Validation feedback for malformed entries
- Graceful handling of missing fields
- Logging for debugging purposes

## 8. Documentation
- Document supported formats
- Provide examples of valid input
- Add developer notes for adding new formats
- Create user guide for file preparation
