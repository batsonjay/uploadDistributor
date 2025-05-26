// @ts-nocheck
/**
 * Base class for destination API mocks
 * 
 * This class provides common functionality for all destination API mocks:
 * - Request recording
 * - Field validation
 * - Authentication stub
 */

import { log } from '@uploadDistributor/logging';

export interface RequestRecord {
  endpoint: string;
  data: any;
  timestamp: string;
}

export class DestinationApiMock {
  protected destination: string;
  protected requests: RequestRecord[] = [];

  constructor(destination: string) {
    this.destination = destination;
  }

  /**
   * Record API calls for verification
   */
  protected recordRequest(endpoint: string, data: any): void {
    const record: RequestRecord = {
      endpoint,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.requests.push(record);
    log('D:API   ', 'DM:001', `[${this.destination}] Request to ${endpoint}: ${JSON.stringify(data, null, 2)}`);
  }

  /**
   * Validate required fields in data
   */
  protected validateRequiredFields(data: any, requiredFields: string[]): boolean {
    const missing = requiredFields.filter(field => !data[field]);
    
    if (missing.length > 0) {
      log('D:API   ', 'DM:002', `[${this.destination}] Missing required fields: ${missing.join(', ')}`);
      return false;
    }
    
    log('D:API   ', 'DM:003', `[${this.destination}] All required fields present`);
    return true;
  }

  /**
   * Stub for authentication (to be implemented later)
   */
  public authenticate(): Promise<{ success: boolean; token: string }> {
    log('D:API   ', 'DM:004', `[${this.destination}] Authentication stub called`);
    return Promise.resolve({ success: true, token: 'mock-token' });
  }

  /**
   * Get recorded requests for verification
   */
  public getRecordedRequests(): RequestRecord[] {
    return this.requests;
  }

  /**
   * Reset mock state
   */
  public reset(): void {
    this.requests = [];
    log('D:API   ', 'DM:005', `[${this.destination}] Mock state reset`);
  }
}
