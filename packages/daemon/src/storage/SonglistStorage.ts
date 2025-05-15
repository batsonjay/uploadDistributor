/**
 * Songlist Storage Module
 * 
 * This module handles persistent storage of songlists.
 * Songlists are stored in folders organized by DJ name.
 * Filenames are in the format: yyyy-mm-dd-title (spaces in title replaced by hyphens)
 */

import * as fs from 'fs';
import * as path from 'path';
import { USER_ROLES, UserRole } from '../services/AuthService.js';

// Define the songlist data structure
export interface TrackData {
  title: string;
  artist: string;
}

export interface BroadcastData {
  broadcast_date: string;
  broadcast_time: string;
  DJ: string;
  setTitle: string;
  duration: string;
  genre?: string;
  tags?: string[];
  artwork?: string;
  description?: string;
}

export interface PlatformSpecificData {
  mixcloud?: {
    tags?: string[];
    publish_date?: string;
  };
  soundcloud?: {
    sharing?: 'public' | 'private';
    license?: string;
  };
}

export interface SonglistData {
  broadcast_data: BroadcastData;
  track_list: TrackData[];
  platform_specific?: PlatformSpecificData;
  user_role?: UserRole;
  version: string;
}

// Base directory for songlist storage
const SONGLISTS_DIR = process.env.SONGLISTS_DIR || path.join(__dirname, '../../../songlists');

/**
 * Store a songlist persistently
 * 
 * @param uploadId The ID of the upload
 * @param songlist The songlist data to store
 * @returns The path to the stored songlist file
 */
export function storeSonglist(uploadId: string, songlist: SonglistData): string {
  // Create the DJ directory if it doesn't exist
  const djDir = path.join(SONGLISTS_DIR, songlist.broadcast_data.DJ);
  if (!fs.existsSync(djDir)) {
    fs.mkdirSync(djDir, { recursive: true });
  }
  
  // Create a filename based on broadcast date and title
  // Format: yyyy-mm-dd-title (spaces in title replaced by hyphens)
  const filename = `${songlist.broadcast_data.broadcast_date}-${
    songlist.broadcast_data.setTitle.replace(/\s+/g, '-')
  }.json`;
  
  const filePath = path.join(djDir, filename);
  
  // Write the songlist to file
  fs.writeFileSync(filePath, JSON.stringify(songlist, null, 2));
  
  process.stdout.write(`Songlist stored at: ${filePath}\n`);
  
  return filePath;
}

/**
 * Get a songlist by DJ and title
 * 
 * @param dj The DJ name
 * @param title The set title
 * @returns The songlist data or null if not found
 */
export function getSonglistByDjAndTitle(dj: string, title: string): SonglistData | null {
  const djDir = path.join(SONGLISTS_DIR, dj);
  
  // Check if DJ directory exists
  if (!fs.existsSync(djDir)) {
    return null;
  }
  
  // List all files in the DJ directory
  const files = fs.readdirSync(djDir);
  
  // Find a file that contains the title (with spaces replaced by hyphens)
  const titlePattern = title.replace(/\s+/g, '-');
  const matchingFile = files.find(file => file.includes(titlePattern));
  
  if (!matchingFile) {
    return null;
  }
  
  // Read and parse the songlist file
  try {
    const filePath = path.join(djDir, matchingFile);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent) as SonglistData;
  } catch (err) {
    process.stderr.write(`Error reading songlist file: ${err}\n`);
    return null;
  }
}

/**
 * Parse a songlist file
 * 
 * @param filePath The path to the songlist file
 * @returns The parsed songlist data
 */
export function parseSonglist(filePath: string): SonglistData {
  // For now, we'll just assume the file is already in the correct JSON format
  // In a real implementation, this would handle different formats (CSV, text, etc.)
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const songlist = JSON.parse(fileContent) as SonglistData;
    
    // Add default value for user_role if it doesn't exist
    if (!songlist.user_role) {
      songlist.user_role = USER_ROLES.DJ;
    }
    
    return songlist;
  } catch (err) {
    process.stderr.write(`Error parsing songlist file: ${err}\n`);
    throw new Error(`Failed to parse songlist file: ${err}`);
  }
}

/**
 * List all songlists for a DJ
 * 
 * @param dj The DJ name
 * @returns An array of songlist data
 */
export function listSonglistsByDj(dj: string): SonglistData[] {
  const djDir = path.join(SONGLISTS_DIR, dj);
  
  // Check if DJ directory exists
  if (!fs.existsSync(djDir)) {
    return [];
  }
  
  // List all files in the DJ directory
  const files = fs.readdirSync(djDir);
  
  // Read and parse each songlist file
  const songlists: SonglistData[] = [];
  
  for (const file of files) {
    try {
      const filePath = path.join(djDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      songlists.push(JSON.parse(fileContent) as SonglistData);
    } catch (err) {
      process.stderr.write(`Error reading songlist file ${file}: ${err}\n`);
    }
  }
  
  return songlists;
}
