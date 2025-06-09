/**
 * IndexedDB utility for storing and retrieving large files
 * Used by the /send workflow to maintain file references across page navigation
 */

interface StoredFileData {
  file: File;
  timestamp: number;
  metadata: {
    name: string;
    size: number;
    type: string;
  };
}

class FileStorageManager {
  private dbName = 'uploadDistributorFiles';
  private dbVersion = 1;
  private storeName = 'files';

  /**
   * Initialize IndexedDB
   */
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Store a file in IndexedDB
   */
  async storeFile(key: string, file: File): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const fileData: StoredFileData = {
        file,
        timestamp: Date.now(),
        metadata: {
          name: file.name,
          size: file.size,
          type: file.type
        }
      };

      const request = store.put({ id: key, ...fileData });

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log(`File stored successfully: ${key} (${file.name}, ${file.size} bytes)`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error storing file:', error);
      throw error;
    }
  }

  /**
   * Retrieve a file from IndexedDB
   */
  async getFile(key: string): Promise<File | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.file) {
            console.log(`File retrieved successfully: ${key} (${result.metadata.name}, ${result.metadata.size} bytes)`);
            resolve(result.file);
          } else {
            console.log(`File not found: ${key}`);
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error retrieving file:', error);
      throw error;
    }
  }

  /**
   * Remove a file from IndexedDB
   */
  async removeFile(key: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log(`File removed successfully: ${key}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error removing file:', error);
      throw error;
    }
  }

  /**
   * Check if a file exists in IndexedDB
   */
  async hasFile(key: string): Promise<boolean> {
    try {
      const file = await this.getFile(key);
      return file !== null;
    } catch (error) {
      console.error('Error checking file existence:', error);
      return false;
    }
  }

  /**
   * Get file metadata without loading the full file
   */
  async getFileMetadata(key: string): Promise<{ name: string; size: number; type: string } | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.metadata) {
            resolve(result.metadata);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error retrieving file metadata:', error);
      throw error;
    }
  }

  /**
   * Clear all stored files (cleanup)
   */
  async clearAllFiles(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log('All files cleared from storage');
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error clearing files:', error);
      throw error;
    }
  }

  /**
   * Clean up old files (older than 24 hours)
   */
  async cleanupOldFiles(): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            console.log(`Cleaning up old file: ${cursor.value.id}`);
            cursor.delete();
            cursor.continue();
          } else {
            console.log('Cleanup completed');
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const fileStorage = new FileStorageManager();

// Convenience functions for the send workflow
export const storeSendFiles = async (audioFile: File | null, artworkFile: File | null) => {
  const promises: Promise<void>[] = [];
  
  if (audioFile) {
    promises.push(fileStorage.storeFile('send_audio', audioFile));
  }
  
  if (artworkFile) {
    promises.push(fileStorage.storeFile('send_artwork', artworkFile));
  }
  
  await Promise.all(promises);
};

export const getSendFiles = async (): Promise<{ audio: File | null; artwork: File | null }> => {
  const [audio, artwork] = await Promise.all([
    fileStorage.getFile('send_audio'),
    fileStorage.getFile('send_artwork')
  ]);
  
  return { audio, artwork };
};

export const clearSendFiles = async () => {
  await Promise.all([
    fileStorage.removeFile('send_audio'),
    fileStorage.removeFile('send_artwork')
  ]);
};

export const getSendFileMetadata = async (): Promise<{
  audio: { name: string; size: number; type: string } | null;
  artwork: { name: string; size: number; type: string } | null;
}> => {
  const [audio, artwork] = await Promise.all([
    fileStorage.getFileMetadata('send_audio'),
    fileStorage.getFileMetadata('send_artwork')
  ]);
  
  return { audio, artwork };
};
