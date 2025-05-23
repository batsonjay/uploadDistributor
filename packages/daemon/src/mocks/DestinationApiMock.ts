// @ts-nocheck
/**
 * Base class for destination API mocks
 * 
 * This class provides common functionality for all destination API mocks:
 * - Request recording
 * - Field validation
 * - Authentication stub
 */

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
    process.stdout.write(`[${this.destination}] Request to ${endpoint}: ${JSON.stringify(data, null, 2)}\n`);
  }

  /**
   * Validate required fields in data
   */
  protected validateRequiredFields(data: any, requiredFields: string[]): boolean {
    const missing = requiredFields.filter(field => !data[field]);
    
    if (missing.length > 0) {
      process.stderr.write(`[${this.destination}] Missing required fields: ${missing.join(', ')}\n`);
      return false;
    }
    
    process.stdout.write(`[${this.destination}] All required fields present\n`);
    return true;
  }

  /**
   * Stub for authentication (to be implemented later)
   */
  public authenticate(): Promise<{ success: boolean; token: string }> {
    process.stdout.write(`[${this.destination}] Authentication stub called\n`);
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
    process.stdout.write(`[${this.destination}] Mock state reset\n`);
  }
}
