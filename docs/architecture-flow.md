# Architecture Flow Diagrams

This document provides visual representations of key flows within the Upload Distributor system.

## Authentication Flow

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'lineColor': 'white', 'textColor': 'white', 'mainBkg': '#2a2a2a', 'nodeBorder': 'white' }}}%%
sequenceDiagram
    participant User
    participant Client as Web/macOS Client
    participant Daemon
    participant Email as Email Service
    participant AzuraCast

    User->>Client: Enter email address
    Client->>Daemon: POST /auth/request-login
    Daemon->>Email: Generate & send magic link
    Email-->>User: Magic link email
    User->>Client: Click magic link
    Client->>Daemon: POST /auth/verify-login
    Daemon->>AzuraCast: Verify user exists
    AzuraCast-->>Daemon: User info & role
    Daemon->>Daemon: Generate JWT token with role-based expiration
    Daemon-->>Client: JWT token & user profile
    Client->>Client: Store token in localStorage
    Client-->>User: Redirect to upload page
```

## Upload Flow

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'lineColor': 'white', 'textColor': 'white', 'mainBkg': '#2a2a2a', 'nodeBorder': 'white' }}}%%
sequenceDiagram
    participant User
    participant Client as Web/macOS Client
    participant Daemon
    participant Destinations as AzuraCast/Mixcloud/SoundCloud

    User->>Client: Upload MP3, songlist, artwork
    User->>Client: Enter metadata
    Client->>Client: Validate files & metadata
    Client->>Daemon: POST /receive with files & metadata
    Daemon->>Daemon: Store files
    Daemon->>Daemon: Parse songlist
    Daemon->>Daemon: Create worker thread for distribution
    
    alt DJ User
        Daemon-->>Client: Return success immediately
        Client-->>User: Show upload success
    else Admin User
        Daemon-->>Client: Return fileId
        Client->>Daemon: GET /status/:fileId (polling)
        Daemon->>Destinations: Upload to all platforms
        Destinations-->>Daemon: Upload results
        Daemon-->>Client: Detailed status
        Client-->>User: Show detailed results
    end
```

## Songlist Parsing Flow

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'lineColor': 'white', 'textColor': 'white', 'mainBkg': '#2a2a2a', 'nodeBorder': 'white' }}}%%
sequenceDiagram
    participant Client as Web/macOS Client
    participant Daemon
    participant Parser as Songlist Parser
    participant Storage as Songlist Storage

    Client->>Daemon: POST /parse-songlist with file
    Daemon->>Parser: Detect format & route to appropriate parser
    
    alt NML File
        Parser->>Parser: Parse XML structure
    else RTF File
        Parser->>Parser: Convert to text & parse
    else TXT File
        Parser->>Parser: Parse line by line
    else DOCX File
        Parser->>Parser: Extract text & parse
    else M3U8 File
        Parser->>Parser: Parse EXTINF entries
    end
    
    Parser->>Parser: Normalize output
    Parser-->>Daemon: Return parsed songs
    Daemon-->>Client: Return parsed songs
    
    alt During Upload
        Daemon->>Storage: Store normalized songlist
    end
```

## DJ Selector Flow (Super Admin Only)

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': { 'lineColor': 'white', 'textColor': 'white', 'mainBkg': '#2a2a2a', 'nodeBorder': 'white' }}}%%
sequenceDiagram
    participant Admin as Super Admin
    participant Client as Web Client
    participant Daemon
    participant AzuraCast

    Admin->>Client: Navigate to upload page
    Client->>Daemon: GET /auth/djs
    Daemon->>AzuraCast: Get all users
    AzuraCast-->>Daemon: User list
    Daemon->>Daemon: Filter to DJ role users
    Daemon-->>Client: List of DJs
    Client-->>Admin: Display DJ selector dropdown
    Admin->>Client: Select DJ to upload as
    Admin->>Client: Complete upload form
    Client->>Daemon: POST /receive with selectedDjId
    Daemon->>Daemon: Get selected DJ info
    Daemon->>Daemon: Use DJ name for file naming
    Daemon->>Daemon: Process upload as selected DJ
    Daemon-->>Client: Upload status
    Client-->>Admin: Display result
```
