import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppRouteHandler } from '@/lib/types';

import {
  getAuthType,
  getCurrentApiToken,
  getCurrentSession,
  getCurrentUser,
  isAuthenticated,
} from '@/lib/auth-utils';

import type { GetMeRoute, GetProfileRoute } from './user.routes';

export const getMe: AppRouteHandler<GetMeRoute> = async (c) => {
  const user = getCurrentUser(c);
  const session = getCurrentSession(c);
  const apiToken = getCurrentApiToken(c);
  const authType = getAuthType(c);

  return c.json(
    {
      user,
      session,
      apiToken: apiToken ? { id: 'hidden-for-security' } : null, // Don't expose full token
      authType,
      isAuthenticated: isAuthenticated(c),
    },
    HttpStatusCodes.OK,
  );
};

export const getProfile: AppRouteHandler<GetProfileRoute> = async (c) => {
  const user = getCurrentUser(c);
  const session = getCurrentSession(c);
  const authType = getAuthType(c) as 'session' | 'api-token';

  return c.json(
    {
      user,
      session,
      authType,
      message: `This is a protected route - you are authenticated via ${authType}!`,
    },
    HttpStatusCodes.OK,
  );
};
