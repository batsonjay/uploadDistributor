/**
 * Shared Upload Module
 * 
 * This module provides a consistent upload implementation that can be used by
 * both the web client and macOS client. It handles:
 * - File uploads with progress tracking
 * - Status polling
 * - Error handling
 * 
 * This ensures that both clients use the same underlying logic for uploads.
 */

import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

// Types for upload parameters
export interface UploadMetadata {
  userId: string;
  title: string;
  djName: string;
  azcFolder: string;
  azcPlaylist: string;
  userRole?: string;
  destinations?: string;
}

export interface UploadFiles {
  audioFile: File | Buffer | NodeJS.ReadableStream;
  songlistFile: File | Buffer | NodeJS.ReadableStream;
}

export interface UploadCallbacks {
  onProgress?: (percent: number) => void;
  onStatusChange?: (status: string, details: any) => void;
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
}

export interface UploadOptions {
  apiUrl: string;
  token?: string;
  uploadId?: string;
  pollingInterval?: number;
  maxPollingAttempts?: number;
}

export interface UploadResult {
  uploadId: string;
  status: string;
  message?: string;
}

/**
 * Upload files to the daemon with progress tracking
 */
export async function uploadFiles(
  metadata: UploadMetadata,
  files: UploadFiles,
  callbacks: UploadCallbacks = {},
  options: UploadOptions
): Promise<UploadResult> {
  const {
    apiUrl,
    token,
    uploadId,
    pollingInterval = 1000,
    maxPollingAttempts = 30
  } = options;
  
  const { onProgress, onStatusChange, onComplete, onError } = callbacks;
  
  try {
    // Create form data
    const formData = createFormData(metadata, files);
    
    // Configure request with progress tracking
    const config: AxiosRequestConfig = {
      headers: {
        ...(formData.getHeaders ? formData.getHeaders() : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(uploadId ? { 'x-upload-id': uploadId } : {})
      },
      onUploadProgress: (progressEvent) => {
        // Handle case where total might be undefined
        const total = progressEvent.total || 0;
        const percent = total > 0 ? Math.round((progressEvent.loaded * 100) / total) : 0;
        if (onProgress) {
          onProgress(percent);
        }
      }
    };
    
    // Send the upload request
    const response = await axios.post(`${apiUrl}/upload`, formData, config);
    
    // Extract upload ID from response
    const responseUploadId = response.data.uploadId;
    
    // Start polling for status if callbacks are provided
    if (onStatusChange || onComplete) {
      pollUploadStatus(
        responseUploadId,
        apiUrl,
        token,
        onStatusChange,
        onComplete,
        pollingInterval,
        maxPollingAttempts
      );
    }
    
    return response.data;
  } catch (error) {
    if (onError) {
      onError(error as Error);
    }
    throw error;
  }
}

/**
 * Create form data from metadata and files
 * This function handles both browser and Node.js environments
 */
function createFormData(metadata: UploadMetadata, files: UploadFiles): any {
  // Detect environment - use a safer check that works in both Node.js and browser
  const isBrowser = typeof process === 'undefined' || !process.versions || !process.versions.node;
  
  let formData: any;
  
  if (isBrowser) {
    // Browser environment
    formData = new FormData();
    
    // Add metadata
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value);
      }
    });
    
    // Add files
    formData.append('audio', files.audioFile);
    formData.append('songlist', files.songlistFile);
  } else {
    // Node.js environment
    // We need to use the form-data package
    // This will be required by the client
    const FormData = require('form-data');
    formData = new FormData();
    
    // Add metadata
    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, value);
      }
    });
    
    // Add files
    formData.append('audio', files.audioFile);
    formData.append('songlist', files.songlistFile);
  }
  
  return formData;
}

/**
 * Poll for upload status
 */
async function pollUploadStatus(
  uploadId: string,
  apiUrl: string,
  token?: string,
  onStatusChange?: (status: string, details: any) => void,
  onComplete?: (result: any) => void,
  pollingInterval: number = 1000,
  maxAttempts: number = 30
): Promise<void> {
  let completed = false;
  let attempts = 0;
  let lastStatus = '';
  let statusTransitions: string[] = [];
  
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  while (!completed && attempts < maxAttempts) {
    try {
      const response = await axios.get(`${apiUrl}/status/${uploadId}`, { headers });
      const currentStatus = response.data.status;
      
      // Only trigger callback when status changes
      if (currentStatus !== lastStatus) {
        if (onStatusChange) {
          onStatusChange(currentStatus, response.data);
        }
        statusTransitions.push(currentStatus);
        lastStatus = currentStatus;
      }
      
      if (['completed', 'error'].includes(currentStatus)) {
        completed = true;
        if (onComplete) {
          // Add status transitions to the result
          const resultWithTransitions = {
            ...response.data,
            statusTransitions
          };
          onComplete(resultWithTransitions);
        }
      } else {
        // Wait before polling again
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        attempts++;
      }
    } catch (error) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }
  }
  
  // If we reached max attempts without completion, call onComplete with timeout info
  if (!completed && onComplete) {
    onComplete({
      status: 'timeout',
      message: `Polling timed out after ${maxAttempts} attempts`,
      uploadId
    });
  }
}

/**
 * Get the current status of an upload
 */
export async function getUploadStatus(
  uploadId: string,
  apiUrl: string,
  token?: string
): Promise<any> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  try {
    const response = await axios.get(`${apiUrl}/status/${uploadId}`, { headers });
    return response.data;
  } catch (error) {
    throw error;
  }
}
