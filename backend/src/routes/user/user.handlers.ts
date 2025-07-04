import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppRouteHandler } from '@/lib/types';

import { getAuthType, getCurrentApiToken, getCurrentSession, getCurrentUser, isAuthenticated } from '@/lib/auth-utils';
import { createStandardSuccessResponse } from '@/lib/response-utils';

import type { GetMeRoute } from './user.routes';

export const getMe: AppRouteHandler<GetMeRoute> = async (c) => {
  const user = getCurrentUser(c);
  const session = getCurrentSession(c);
  const apiToken = getCurrentApiToken(c);
  const authType = getAuthType(c);
  const authenticated = isAuthenticated(c);

  // Provide a helpful message based on authentication status
  let message: string | undefined;
  if (authenticated) {
    message = `Authenticated via ${authType}. ${
      authType === 'session' ? 'Browser session active.' : 'API token valid.'
    }`;
  } else {
    message = 'Not authenticated. Use session login or provide API token in Authorization header.';
  }

  return c.json(
    createStandardSuccessResponse({
      user,
      session,
      apiToken: apiToken ? { id: 'hidden-for-security' } : null, // Don't expose full token
      authType,
      isAuthenticated: authenticated,
      message,
    }),
    HttpStatusCodes.OK,
  );
};
