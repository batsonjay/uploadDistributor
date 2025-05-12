/**
 * Retry Utilities
 * 
 * This module provides utilities for retrying operations with exponential backoff.
 * It can be used by any service that needs to retry operations, particularly
 * when dealing with external APIs that may have rate limits or intermittent failures.
 */

/**
 * Options for the retry operation
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  
  /** Initial delay in milliseconds before the first retry (default: 1000) */
  initialDelay?: number;
  
  /** Factor by which the delay increases with each retry (default: 2) */
  backoffFactor?: number;
  
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  
  /** Optional callback for logging retry attempts */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  
  /** 
   * Optional function to determine if an error is retryable
   * If not provided, all errors are considered retryable
   */
  isRetryable?: (error: Error) => boolean;
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn The function to retry
 * @param options Retry options
 * @returns The result of the function
 * @throws The last error encountered if all retries fail
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    backoffFactor = 2,
    maxDelay = 30000,
    onRetry,
    isRetryable = () => true
  } = options;
  
  let attempt = 0;
  let lastError: Error;
  
  while (attempt <= maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // If we've reached the maximum number of retries, or the error is not retryable, throw the error
      if (attempt >= maxRetries || !isRetryable(lastError)) {
        throw lastError;
      }
      
      // Calculate the delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);
      
      // Call the onRetry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, lastError, delay);
      }
      
      // Wait for the calculated delay
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Increment the attempt counter
      attempt++;
    }
  }
  
  // This should never be reached due to the throw in the catch block
  // But TypeScript requires a return statement
  throw lastError!;
}

/**
 * Create a retry function with predefined options
 * 
 * @param defaultOptions Default retry options
 * @returns A retry function with the default options
 */
export function createRetryFunction(defaultOptions: RetryOptions = {}) {
  return <T>(fn: () => Promise<T>, options: RetryOptions = {}) => {
    return retry(fn, { ...defaultOptions, ...options });
  };
}
