# Songlists

This document defines the structure, normalization, and storage of songlist files used in the Upload Distributor project.

## Purpose

Songlists accompany each `.mp3` upload and describe the track breakdown of the audio. They are used for metadata enrichment and platform-specific tracklist features.

## Accepted Formats

- **CSV**: Comma-separated values with headers.
- **JSON**: Structured format with defined schema.

## Normalization Rules

- All entries must include:
  - `start_time` (in `HH:MM:SS` format)
  - `artist`
  - `title`
- Optional fields:
  - `label`
  - `duration`
- Timestamps are validated and normalized to a consistent format.
- Artist/title capitalization is standardized.

## Example (CSV)

```csv
start_time,artist,title,label
00:00:00,Artist A,Track One,Label X
00:05:30,Artist B,Track Two,Label Y
```

## Example (JSON)

```json
[
  {
    "start_time": "00:00:00",
    "artist": "Artist A",
    "title": "Track One",
    "label": "Label X"
  },
  {
    "start_time": "00:05:30",
    "artist": "Artist B",
    "title": "Track Two",
    "label": "Label Y"
  }
]
```

## Persistent Storage

- Songlists are stored persistently by the daemon.
- Storage format: JSON
- Storage location: Local filesystem or database (TBD)
- Each songlist is associated with a unique upload ID.

## Usage

- Parsed and validated during upload processing.
- Used to populate tracklists on Mixcloud and AzuraCast.
- Not used by SoundCloud (but retained for consistency).

## Versioning

- Songlist schema may evolve.
- Version field may be added to support backward compatibility.
