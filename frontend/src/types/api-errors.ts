/**
 * TypeScript types for standardized API error responses
 * Matches the backend StandardErrorSchema format
 */

/**
 * Standard API error response format from backend
 */
export interface StandardErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    requestId?: string;
  };
}

/**
 * Standard API success response format
 */
export interface StandardSuccessResponse<T = any> {
  success: true;
  data: T;
  creditsCost?: number;
  requestId?: string;
  timestamp?: string;
}

/**
 * Union type for all API responses
 */
export type ApiResponse<T = any> = StandardSuccessResponse<T> | StandardErrorResponse;

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: any): response is StandardErrorResponse {
  return response && typeof response === 'object' && response.success === false && response.error;
}

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(response: any): response is StandardSuccessResponse<T> {
  return response && typeof response === 'object' && response.success === true && response.data !== undefined;
}

/**
 * Common error codes from backend
 */
export const ERROR_CODES = {
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED: 'authentication_required',
  INVALID_API_KEY: 'invalid_api_key',
  PERMISSION_DENIED: 'permission_denied',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',

  // Validation
  VALIDATION_ERROR: 'validation_error',
  INVALID_PARAMETER: 'invalid_parameter',
  MISSING_PARAMETER: 'missing_parameter',

  // Resources
  RESOURCE_NOT_FOUND: 'resource_not_found',
  RESOURCE_CONFLICT: 'resource_conflict',

  // Server Errors
  INTERNAL_SERVER_ERROR: 'internal_server_error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
  TIMEOUT_ERROR: 'timeout_error',

  // Browser/System Specific
  BROWSER_UNAVAILABLE: 'browser_unavailable',
  BROWSER_SESSION_INVALID: 'browser_session_invalid',

  // File Operations
  FILE_NOT_FOUND: 'file_not_found',
  FILE_UPLOAD_FAILED: 'file_upload_failed',
  STORAGE_ERROR: 'storage_error',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
