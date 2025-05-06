/**
 * Timezone Utilities
 * 
 * This module provides utilities for converting between different timezones.
 * Specifically, it handles conversion between UTC and Central European Time (CET/CEST).
 */

/**
 * Converts a UTC timestamp to Central European Time (CET/CEST)
 * @param utcTimestamp UTC timestamp in ISO format
 * @returns Timestamp in CET/CEST
 */
export function utcToCet(utcTimestamp: string): string {
  const date = new Date(utcTimestamp);
  
  // Create a formatter that explicitly uses the Europe/Berlin timezone (CET/CEST)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Format the date
  const formattedDate = formatter.format(date);
  
  // Convert from MM/DD/YYYY, HH:MM:SS to YYYY-MM-DD HH:MM:SS
  const parts = formattedDate.split(', ');
  if (parts.length < 2) {
    throw new Error(`Invalid formatted date: ${formattedDate}`);
  }
  
  const datePart = parts[0] as string;
  const timePart = parts[1] as string;
  
  const dateParts = datePart.split('/');
  if (dateParts.length < 3) {
    throw new Error(`Invalid date part: ${datePart}`);
  }
  
  const year = dateParts[2];
  const month = dateParts[0];
  const day = dateParts[1];
  
  return `${year}-${month}-${day} ${timePart}`;
}

/**
 * Converts a CET/CEST timestamp to UTC
 * @param cetTimestamp Timestamp in CET/CEST (YYYY-MM-DD HH:MM:SS)
 * @returns UTC timestamp in ISO format
 */
export function cetToUtc(cetTimestamp: string): string {
  // Parse the CET timestamp
  const parts = cetTimestamp.split(' ');
  if (parts.length < 2) {
    throw new Error(`Invalid CET timestamp format: ${cetTimestamp}`);
  }
  
  const datePart = parts[0] as string;
  const timePart = parts[1] as string;
  
  const dateParts = datePart.split('-');
  if (dateParts.length < 3) {
    throw new Error(`Invalid date part: ${datePart}`);
  }
  
  const timeParts = timePart.split(':');
  if (timeParts.length < 3) {
    throw new Error(`Invalid time part: ${timePart}`);
  }
  
  const year = dateParts[0] || '2000';
  const month = dateParts[1] || '01';
  const day = dateParts[2] || '01';
  const hour = timeParts[0] || '00';
  const minute = timeParts[1] || '00';
  const second = timeParts[2] || '00';
  
  // Create a date object in the Europe/Berlin timezone
  const date = new Date();
  date.setFullYear(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  date.setHours(parseInt(hour, 10), parseInt(minute, 10), parseInt(second, 10));
  
  // Calculate the offset between local time and CET
  const localOffset = date.getTimezoneOffset();
  const cetOffset = -60; // CET is UTC+1, CEST is UTC+2 (handled automatically by the browser)
  const offsetDiff = (localOffset - cetOffset) * 60 * 1000;
  
  // Adjust the date to UTC
  const utcDate = new Date(date.getTime() + offsetDiff);
  
  // Return ISO string
  return utcDate.toISOString();
}
