import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppRouteHandler } from '@/lib/types';

import { createStandardErrorResponse, createStandardSuccessResponse, ERROR_CODES } from '@/lib/response-utils';

import type { CreateApiKeyRoute, DeleteApiKeyRoute, GetApiKeyRoute, ListApiKeysRoute } from './api-keys.routes';

export const createApiKey: AppRouteHandler<CreateApiKeyRoute> = async (c) => {
  try {
    const auth = c.get('auth');
    const { name } = c.req.valid('json');

    // Create API key with configured defaults
    const result = await (auth.api as any).createApiKey({
      body: {
        name,
        prefix: c.env.API_KEY_PREFIX || 'wq_',
        metadata: {
          plan: c.get('plan') || 'free',
        },
      },
      headers: c.req.header(),
    });

    return c.json(createStandardSuccessResponse(result), HttpStatusCodes.CREATED);
  } catch (error) {
    console.error('Create API key error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Failed to create API key',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

export const listApiKeys: AppRouteHandler<ListApiKeysRoute> = async (c) => {
  try {
    const auth = c.get('auth');
    const user = c.get('user');

    console.log('ListApiKeys - Starting debug...');
    console.log('ListApiKeys - User ID:', user?.id);
    console.log('ListApiKeys - User email:', user?.email);
    console.log('ListApiKeys - Auth instance exists:', !!auth);

    // Test database connectivity first
    try {
      const db = (auth as any)._db || (auth as any).db;
      console.log('ListApiKeys - Database instance exists:', !!db);

      if (db) {
        // Try a simple query to test database connectivity
        console.log('ListApiKeys - Testing database connectivity...');
        const _testQuery = await db
          .select()
          .from({ id: 'test' })
          .limit(1)
          .catch((err: any) => {
            console.log('ListApiKeys - Database connectivity test result:', err.message || 'Unknown error');
            return [];
          });
        console.log('ListApiKeys - Database test completed');
      }
    } catch (dbError) {
      console.error('ListApiKeys - Database connectivity test failed:', dbError);
    }

    // Try to access the API key functionality
    console.log('ListApiKeys - Attempting to call auth.api.listApiKeys...');

    // Test if auth.api exists and has the listApiKeys method
    console.log('ListApiKeys - auth.api exists:', !!(auth as any).api);
    console.log('ListApiKeys - auth.api.listApiKeys exists:', typeof (auth as any).api?.listApiKeys);

    if (!(auth as any).api?.listApiKeys) {
      console.error('ListApiKeys - listApiKeys method not found on auth.api');
      return c.json(
        createStandardSuccessResponse({ error: 'API key functionality not available', apiKeys: [], total: 0 }),
        HttpStatusCodes.OK,
      );
    }

    const result = await (auth.api as any).listApiKeys({
      headers: c.req.header(),
    });

    console.log('ListApiKeys - Success, result type:', typeof result);
    console.log('ListApiKeys - Success, result is array:', Array.isArray(result));
    console.log('ListApiKeys - Success, result length:', Array.isArray(result) ? result.length : 'not-array');

    // More detailed result inspection
    if (result) {
      console.log('ListApiKeys - Result keys:', Object.keys(result));
      if (Array.isArray(result) && result.length > 0) {
        console.log('ListApiKeys - First result item keys:', Object.keys(result[0]));
      }
    }

    // Ensure we return the expected format for the frontend
    // Better Auth returns the raw array, we need to wrap it in the expected structure
    const apiKeys = Array.isArray(result) ? result : [];

    return c.json(
      createStandardSuccessResponse({
        apiKeys,
        total: apiKeys.length,
      }),
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error('List API keys error:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    console.error('Error message:', (error as any)?.message);
    console.error('Error stack:', (error as any)?.stack);

    // Try to extract more error details
    if (error && typeof error === 'object') {
      try {
        console.error('Error JSON:', JSON.stringify(error, null, 2));
      } catch {
        console.error('Could not stringify error object');
      }

      // Check for common error properties
      console.error('Error cause:', (error as any)?.cause);
      console.error('Error code:', (error as any)?.code);
      console.error('Error status:', (error as any)?.status);
      console.error('Error statusCode:', (error as any)?.statusCode);
    }

    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Failed to list API keys',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

export const getApiKey: AppRouteHandler<GetApiKeyRoute> = async (c) => {
  try {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');

    // NOTE: getApiKey API inconsistency - uses 'id' in query params instead of body
    const result = await (auth.api as any).getApiKey({
      query: {
        id,
      },
      headers: c.req.header(),
    });

    if (!result || !result.id) {
      const errorResponse = createStandardErrorResponse('API key not found', ERROR_CODES.RESOURCE_NOT_FOUND);
      return c.json(errorResponse, HttpStatusCodes.NOT_FOUND, {
        'X-Request-ID': errorResponse.error.requestId!,
      });
    }

    return c.json(createStandardSuccessResponse(result), HttpStatusCodes.OK);
  } catch (error) {
    console.error('Get API key error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Failed to get API key',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

export const deleteApiKey: AppRouteHandler<DeleteApiKeyRoute> = async (c) => {
  try {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');

    const deleteResult = await (auth.api as any).deleteApiKey({
      body: {
        keyId: id,
      },
      headers: c.req.header(),
    });

    if ((deleteResult as any)?.deleted === false) {
      const errorResponse = createStandardErrorResponse('API key not found', ERROR_CODES.RESOURCE_NOT_FOUND);
      return c.json(errorResponse, HttpStatusCodes.NOT_FOUND, {
        'X-Request-ID': errorResponse.error.requestId!,
      });
    }

    return c.json(
      createStandardSuccessResponse({
        success: true,
        message: 'API key deleted successfully',
      }),
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error('Delete API key error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Failed to delete API key',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
};

// Note: updateApiKey handler removed - users should create new keys instead of updating existing ones
