# Received Files Directory Structure Implementation

This document outlines the plan for reorganizing the file storage structure in the Upload Distributor project.

## Current Structure

Currently, files are stored in a directory named with a UUID:
```
received-files/
  f66ca46e-5282-4795-a825-ef97a0935c34/
    audio.mp3
    songlist.txt
    metadata.json
    status.json
    artwork.jpg (to be added)
```

## Proposed Structure

The new structure will:
1. Receive files in a temporary UUID directory (as currently done)
2. After processing, move files to an organized archive structure with descriptive filenames:
```
archive/
  2025/
    2025-05-11_DJ_Name/
      2025-05-11_DJ_Name_episode-title.mp3
      2025-05-11_DJ_Name_episode-title.txt
      2025-05-11_DJ_Name_episode-title.json
      2025-05-11_DJ_Name_episode-title_status.json
      2025-05-11_DJ_Name_episode-title.jpg
```

The filenames will include:
- Date (yyyy-mm-dd)
- DJ name (with spaces replaced by hyphens)
- Episode title (with spaces replaced by hyphens)

## Implementation Steps

### 1. Create a File Manager Service

Create a new service to handle file organization:

```typescript
// packages/daemon/src/services/FileManager.ts
import * as fs from 'fs';
import * as path from 'path';
import { SonglistData } from '../storage/SonglistStorage';

export class FileManager {
  private receivedFilesDir: string;
  private archiveDir: string;
  
  constructor() {
    this.receivedFilesDir = process.env.RECEIVED_FILES_DIR || path.join(__dirname, '../../received-files');
    this.archiveDir = process.env.ARCHIVE_DIR || path.join(__dirname, '../../archive');
    
    // Ensure archive directory exists
    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }
  }
  
  /**
   * Move files from temporary UUID directory to organized archive structure
   * @param fileId The UUID of the temporary directory
   * @param songlist The processed songlist data
   * @returns The path to the new directory
   */
  public moveToArchive(fileId: string, songlist: SonglistData): string {
    const tempDir = path.join(this.receivedFilesDir, fileId);
    
    // Extract date components from broadcast_date
    const broadcastDate = songlist.broadcast_data.broadcast_date;
    const [year, month, day] = broadcastDate.split('-');
    
    // Create directory structure: yyyy/yyyy-mm-dd_djname
    const yearDir = path.join(this.archiveDir, year);
    if (!fs.existsSync(yearDir)) {
      fs.mkdirSync(yearDir, { recursive: true });
    }
    
    // Sanitize DJ name for filesystem use
    const sanitizedDjName = songlist.broadcast_data.DJ.replace(/[^a-zA-Z0-9]/g, '_');
    
    // Create the final directory name
    const dirName = `${year}-${month}-${day}_${sanitizedDjName}`;
    const finalDir = path.join(yearDir, dirName);
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(finalDir)) {
      fs.mkdirSync(finalDir, { recursive: true });
    }
    
    // Create the base filename prefix
    const sanitizedTitle = songlist.broadcast_data.setTitle.replace(/[^a-zA-Z0-9]/g, '-');
    const filenamePrefix = `${year}-${month}-${day}_${sanitizedDjName}_${sanitizedTitle}`;
    
    // Move all files from temp directory to final directory with descriptive names
    const files = fs.readdirSync(tempDir);
    for (const file of files) {
      const sourcePath = path.join(tempDir, file);
      
      // Determine the new filename based on the original extension
      let destFilename;
      if (file === 'audio.mp3') {
        destFilename = `${filenamePrefix}.mp3`;
      } else if (file === 'songlist.txt') {
        destFilename = `${filenamePrefix}.txt`;
      } else if (file === 'metadata.json') {
        destFilename = `${filenamePrefix}.json`;
      } else if (file === 'status.json') {
        destFilename = `${filenamePrefix}_status.json`;
      } else if (file.startsWith('artwork')) {
        // Preserve the artwork extension
        const ext = path.extname(file);
        destFilename = `${filenamePrefix}${ext}`;
      } else {
        // For any other files, just use the original name
        destFilename = file;
      }
      
      const destPath = path.join(finalDir, destFilename);
      
      // Copy the file
      fs.copyFileSync(sourcePath, destPath);
    }
    
    // Delete the temporary directory after successful move
    this.deleteDirectory(tempDir);
    
    return finalDir;
  }
  
  /**
   * Delete a directory and all its contents
   * @param dirPath The directory to delete
   */
  private deleteDirectory(dirPath: string): void {
    if (fs.existsSync(dirPath)) {
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const curPath = path.join(dirPath, file);
        
        if (fs.lstatSync(curPath).isDirectory()) {
          // Recursive call for directories
          this.deleteDirectory(curPath);
        } else {
          // Delete file
          fs.unlinkSync(curPath);
        }
      }
      
      // Delete the empty directory
      fs.rmdirSync(dirPath);
    }
  }
}
```

### 2. Update File Processor

Modify `packages/daemon/src/processors/file-processor.ts` to use the FileManager service:

```typescript
// Import the FileManager
import { FileManager } from '../services/FileManager';

// Initialize the FileManager
const fileManager = new FileManager();

// In the processFiles function, after successful processing and before exiting:
async function processFiles() {
  try {
    // ...existing processing code
    
    // After successful processing and updating status
    if (songlist) {
      // Move files to organized archive structure
      const archivePath = fileManager.moveToArchive(fileId, songlist);
      process.stdout.write(`Files moved to archive: ${archivePath}\n`);
      
      // Update status with archive path
      statusManager.updateStatus('completed', 'Processing completed successfully', {
        ...destinations,
        archivePath: archivePath
      });
    }
    
    // ...existing exit code
  } catch (err) {
    // ...existing error handling
  }
}
```

### 3. Update Status Route

Modify the status route to handle the new archive path:

```typescript
// In packages/daemon/src/routes/status.ts
router.get('/:fileId', anyAuthenticated, (req: any, res: any) => {
  // ...existing code
  
  // If the status includes an archive path, update the response
  if (status.archivePath) {
    response.archivePath = status.archivePath;
  }
  
  // ...existing response code
});
```

### 4. Update Environment Variables

Add the new environment variable to `.env.example`:

```
# File Storage
RECEIVED_FILES_DIR=./received-files
ARCHIVE_DIR=./archive
TEMP_DIR=./temp
```

## Benefits

1. **Improved Organization**: Files are stored in a logical, date-based structure
2. **Better Searchability**: Easy to find files by year, date, and DJ name
3. **Reduced Clutter**: Temporary UUID directories are cleaned up after processing
4. **Metadata Preservation**: All original files are preserved in the archive

## Considerations

1. **Migration**: Existing files in the UUID directories will need to be migrated
2. **Error Handling**: Ensure robust error handling during file moves to prevent data loss
3. **Permissions**: Ensure proper file permissions are maintained during moves
4. **Disk Space**: Monitor disk usage as files are duplicated before the original is deleted
