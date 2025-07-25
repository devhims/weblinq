import { randomUUID } from 'node:crypto';

import { z } from '@hono/zod-openapi';

/**
 * HYBRID ERROR SCHEMA APPROACH
 * ===========================
 *
 * We use two complementary error schemas for consistent API responses:
 *
 * 1. For validation errors (422): Use Stoker's `createErrorSchema(inputSchema)`
 *    - Automatically generates realistic validation error examples
 *    - Format: { success: false, error: { issues: [...], name: "ZodError" } }
 *
 * 2. For other errors (401, 500, etc.): Use our `createSimpleErrorSchema()`
 *    - Simple format that matches Stoker's top-level structure
 *    - Format: { success: false, error: { message: "...", code: "..." } }
 *
 * Both schemas maintain consistent top-level structure (success + error object)
 * while providing appropriate detail levels for different error types.
 */

/**
 * Improved error schema with request ID for tracing
 * Use this for auth, server, and other non-validation errors
 */
export const StandardErrorSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      message: z.string(), // human-readable, may be localised
      code: z.string(), // stable machine code e.g. "UNAUTHORIZED"
      requestId: z.string().uuid().optional(), // helps support trace the error
    }),
  })
  .openapi({
    example: {
      success: false,
      error: {
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
        requestId: 'bf68e5de-f6ef-479f-9328-6d3f48d5b7d4',
      },
    },
  });

/**
 * Type for standard error responses that matches StandardErrorSchema
 */
export type StandardErrorResponse = z.infer<typeof StandardErrorSchema>;

/**
 * Create a simple error response that exactly matches SimpleErrorSchema
 * Use this for middleware and route handlers that need to return simple errors
 */
export function createStandardErrorResponse(message: string, code: string): StandardErrorResponse {
  const requestId = randomUUID();
  return {
    success: false,
    error: {
      message,
      code,
      requestId,
    },
  };
}

/**
 * Standard error response format for all WebLinq API endpoints
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: Record<string, any>;
    issues?: Array<{
      code: string;
      path: string[];
      message: string;
      expected?: string;
      received?: string;
    }>;
  };
  timestamp: string;
}

/**
 * Success response wrapper
 */
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  creditsCost?: number;
  requestId: string;
  timestamp: string;
}

/**
 * Zod schemas for consistent API responses
 */
export const errorIssueSchema = z.object({
  code: z.string(),
  path: z.array(z.string()),
  message: z.string(),
  expected: z.string().optional(),
  received: z.string().optional(),
});

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
    details: z.record(z.any()).optional(),
    issues: z.array(errorIssueSchema).optional(),
  }),
  timestamp: z.string(),
});

export const apiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  creditsCost: z.number().optional(),
  requestId: z.string(),
  timestamp: z.string(),
});

export const simpleErrorSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

/**
 * Error codes for consistent error handling
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

/**
 * Create a standardized success schema that matches ApiSuccessResponse<T>
 * This ensures all routes return consistent success response format
 *
 * @param dataSchema - The Zod schema for the response data
 * @returns A standardized success response schema with proper TypeScript validation
 */
export function createStandardSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  if (!dataSchema) throw new Error('dataSchema is required');

  return z.object({
    success: z.literal(true),
    data: dataSchema,
    creditsCost: z.number().optional().describe('Credits consumed by this operation'),
    requestId: z.string().uuid().describe('Unique request identifier for tracing'),
    timestamp: z.string().datetime().describe('ISO timestamp when the response was generated'),
  });
}

/**
 * Create a standard success response that matches ApiSuccessResponse<T>
 * Use this in handlers to return consistent success responses
 */
export function createStandardSuccessResponse<T>(data: T, creditsCost?: number): ApiSuccessResponse<T> {
  const requestId = randomUUID();
  return {
    success: true,
    data,
    creditsCost,
    requestId,
    timestamp: new Date().toISOString(),
  };
}
