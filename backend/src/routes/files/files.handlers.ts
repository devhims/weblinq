import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { WebDurableObject } from '@/durable-objects/user-do';
import type { AppRouteHandler } from '@/lib/types';

import { createStandardErrorResponse, ERROR_CODES } from '@/lib/response-utils';

import type { DeleteFileRoute, ListFilesRoute } from './files.routes';

/**
 * Helper function to get the WebDurableObject stub for a user
 */
function getWebDurableObject(c: { env: CloudflareBindings }, userId: string): DurableObjectStub<WebDurableObject> {
  const namespace = c.env.WEBLINQ_DURABLE_OBJECT;
  console.log('user id', userId);

  // TEMPORARY: Use random IDs in development to force fresh SQLite-enabled instances
  // This bypasses any migration issues with existing instances
  const isDev = c.env.NODE_ENV !== 'production';

  if (isDev) {
    const randomId = `web:${userId}:temp:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    const id = namespace.idFromName(randomId);
    console.log('🧪 DEVELOPMENT: Using random DO ID to guarantee fresh SQLite instance');
    return namespace.get(id);
  } else {
    // Production uses stable versioned IDs
    const id = namespace.idFromName(`web:${userId}:v3`);
    console.log('🏭 PRODUCTION: Using stable versioned DO ID');
    return namespace.get(id);
  }
}

/**
 * List files endpoint - Get list of stored files with pagination
 */
export const listFiles: AppRouteHandler<ListFilesRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;

    // Use Hono's validated query parameters (schema now properly coerces strings to numbers)
    const { type, limit = 20, offset = 0, sort_by = 'created_at', order = 'desc' } = c.req.valid('query');

    console.log('🔍 List files request:', {
      userId: user.id,
      params: { type, limit, offset, sortBy: sort_by, order },
    });

    // Enforce hard cap on limit (should already be validated, but double-check)
    if (limit > 100) {
      const errorResponse = createStandardErrorResponse(
        `Limit parameter must be 100 or less (received ${limit})`,
        ERROR_CODES.INVALID_PARAMETER,
      );
      return c.json(errorResponse, HttpStatusCodes.UNPROCESSABLE_ENTITY, {
        'X-Request-ID': errorResponse.error.requestId!,
      });
    }

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result = await webDurableObject.debugListFiles({ type, limit, offset, sortBy: sort_by, order });

    console.log('📋 List files result:', {
      success: result.success,
      sqliteEnabled: result.data.sqliteStatus.enabled,
      sqliteAvailable: result.data.sqliteStatus.available,
      filesCount: result.data.files.length,
      totalFiles: result.data.totalFiles,
      hasMore: result.data.hasMore,
    });

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('List files error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

/**
 * Delete file endpoint - Delete a file from database and optionally from R2 storage
 */
export const deleteFile: AppRouteHandler<DeleteFileRoute> = async (c: any) => {
  try {
    const user = c.get('user')!;
    const body = c.req.valid('json');

    console.log('🗑️ Delete file request:', { userId: user.id, fileId: body.fileId, deleteFromR2: body.deleteFromR2 });

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result = await webDurableObject.debugDeleteFile(body);

    console.log('🗑️ Delete file result:', {
      success: result.success,
      fileId: result.data.fileId,
      wasFound: result.data.wasFound,
      deletedFromDatabase: result.data.deletedFromDatabase,
      deletedFromR2: result.data.deletedFromR2,
      filename: result.data.deletedFile?.filename,
      error: result.data.error,
    });

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('Delete file error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};
