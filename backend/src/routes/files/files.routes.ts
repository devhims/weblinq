import * as HttpStatusCodes from 'stoker/http-status-codes';
import { jsonContent, jsonContentRequired } from 'stoker/openapi/helpers';
import { createErrorSchema } from 'stoker/openapi/schemas';

import { createRoute, z } from '@hono/zod-openapi';

const tags = ['Files'];

/**
 * Input schemas for file management operations
 */
const listFilesInputSchema = z.object({
  type: z.enum(['screenshot', 'pdf']).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

const deleteFileInputSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  deleteFromR2: z.boolean().optional().default(false).describe('Also delete the file from R2 storage'),
});

/**
 * Output schemas for file management operations
 */
const listFilesOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    sqliteStatus: z.object({
      enabled: z.boolean(),
      available: z.boolean(),
      userId: z.string(),
    }),
    files: z.array(
      z.object({
        id: z.string(),
        type: z.enum(['screenshot', 'pdf']),
        url: z.string(),
        filename: z.string(),
        r2_key: z.string(),
        public_url: z.string(),
        metadata: z.string(),
        created_at: z.string(),
        expires_at: z.string().optional(),
      }),
    ),
    totalFiles: z.number(),
  }),
});

const deleteFileOutputSchema = z.object({
  success: z.boolean(),
  data: z.object({
    fileId: z.string(),
    wasFound: z.boolean(),
    deletedFromDatabase: z.boolean(),
    deletedFromR2: z.boolean(),
    deletedFile: z
      .object({
        id: z.string(),
        type: z.enum(['screenshot', 'pdf']),
        url: z.string(),
        filename: z.string(),
        r2_key: z.string(),
        public_url: z.string(),
        metadata: z.string(),
        created_at: z.string(),
        expires_at: z.string().optional(),
      })
      .optional(),
    error: z.string().optional(),
  }),
});

/**
 * Route definitions
 */
export const listFiles = createRoute({
  path: '/files/list',
  method: 'post',
  request: {
    body: jsonContentRequired(listFilesInputSchema, 'File listing parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(listFilesOutputSchema, 'Files listed successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(listFilesInputSchema), 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

export const deleteFile = createRoute({
  path: '/files/delete',
  method: 'post',
  request: {
    body: jsonContentRequired(deleteFileInputSchema, 'File deletion parameters'),
  },
  tags,
  responses: {
    [HttpStatusCodes.OK]: jsonContent(deleteFileOutputSchema, 'File deleted successfully'),
    [HttpStatusCodes.UNPROCESSABLE_ENTITY]: jsonContent(createErrorSchema(deleteFileInputSchema), 'Validation error'),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      z.object({
        success: z.literal(false),
        error: z.string(),
      }),
      'Internal server error',
    ),
  },
});

// Export route types for handlers
export type ListFilesRoute = typeof listFiles;
export type DeleteFileRoute = typeof deleteFile;
