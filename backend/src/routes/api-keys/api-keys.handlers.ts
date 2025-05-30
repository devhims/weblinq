import { HTTPException } from 'hono/http-exception';
import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppRouteHandler } from '@/lib/types';

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

    return c.json(result, HttpStatusCodes.CREATED);
  }
  catch (error) {
    console.error('Create API key error:', error);
    throw new HTTPException(HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      message: 'Failed to create API key',
    });
  }
};

export const listApiKeys: AppRouteHandler<ListApiKeysRoute> = async (c) => {
  try {
    const auth = c.get('auth');

    const result = await (auth.api as any).listApiKeys({
      headers: c.req.header(),
    });

    return c.json(result, HttpStatusCodes.OK);
  }
  catch (error) {
    console.error('List API keys error:', error);
    throw new HTTPException(HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      message: 'Failed to list API keys',
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

    return c.json(result, HttpStatusCodes.OK);
  }
  catch (error) {
    console.error('Get API key error:', error);
    throw new HTTPException(HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      message: 'Failed to get API key',
    });
  }
};

export const deleteApiKey: AppRouteHandler<DeleteApiKeyRoute> = async (c) => {
  try {
    const auth = c.get('auth');
    const { id } = c.req.valid('param');

    const _result = await (auth.api as any).deleteApiKey({
      body: {
        keyId: id,
      },
      headers: c.req.header(),
    });

    return c.json({
      success: true,
      message: 'API key deleted successfully',
    }, HttpStatusCodes.OK);
  }
  catch (error) {
    console.error('Delete API key error:', error);
    throw new HTTPException(HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      message: 'Failed to delete API key',
    });
  }
};

// Note: updateApiKey handler removed - users should create new keys instead of updating existing ones
