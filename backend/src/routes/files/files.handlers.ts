import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { WebDurableObject } from '@/durable-objects/web-durable-object';
import type { AppRouteHandler } from '@/lib/types';

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
    const body = c.req.valid('json');

    console.log('🔍 List files request:', { userId: user.id, params: body });

    const webDurableObject = getWebDurableObject(c, user.id);
    await webDurableObject.initializeUser(user.id);

    const result = await webDurableObject.debugListFiles(body);

    console.log('📋 List files result:', {
      success: result.success,
      sqliteEnabled: result.data.sqliteStatus.enabled,
      sqliteAvailable: result.data.sqliteStatus.available,
      filesCount: result.data.files.length,
      totalFiles: result.data.totalFiles,
    });

    return c.json(result, HttpStatusCodes.OK);
  } catch (error) {
    console.error('List files error:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
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
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      HttpStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }
};
