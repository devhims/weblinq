/**
 * Utilities for handling standardized backend error responses
 * Supports the new StandardErrorSchema format from backend
 */

// Type definitions matching the backend StandardErrorSchema
export interface StandardErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    requestId?: string;
  };
}

/**
 * Specialized error class for API errors that contain structured error information
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly requestId?: string;

  constructor(message: string, status: number, code?: string, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/**
 * Parse error response from backend API
 * Handles both StandardErrorSchema format and fallback to plain text
 */
export async function parseErrorResponse(response: Response): Promise<ApiError> {
  const status = response.status;

  try {
    // Try to parse as JSON first (StandardErrorSchema format)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json();

      // Check if it matches StandardErrorSchema format
      if (errorData && typeof errorData === 'object' && errorData.success === false && errorData.error) {
        const { message, code, requestId } = errorData.error;
        return new ApiError(message, status, code, requestId);
      }

      // Fallback for other JSON error formats
      const errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      return new ApiError(errorMessage, status);
    }
  } catch (jsonError) {
    // If JSON parsing fails, fall back to text
  }

  // Fallback to plain text error
  try {
    const errorText = await response.text();
    return new ApiError(errorText || `HTTP ${status}: ${response.statusText}`, status);
  } catch (textError) {
    return new ApiError(`HTTP ${status}: ${response.statusText}`, status);
  }
}

/**
 * Generic API request helper with standardized error handling
 */
export async function makeApiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    const apiError = await parseErrorResponse(response);
    throw apiError;
  }

  // Handle successful response
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  return null as T;
}

/**
 * Extract user-friendly error message from an error object
 * Prioritizes ApiError message, then falls back to generic error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
}

/**
 * Extract error code from an error object
 * Returns the code if available, otherwise undefined
 */
export function getErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return error.code;
  }

  return undefined;
}

/**
 * Extract request ID from an error object for debugging
 * Returns the requestId if available, otherwise undefined
 */
export function getErrorRequestId(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    return error.requestId;
  }

  return undefined;
}
