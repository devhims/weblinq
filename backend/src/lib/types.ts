import type { Session, User } from 'better-auth';

import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';

import type { ApiKey } from './auth';

export interface AppBindings {
  Bindings: CloudflareBindings;
  Variables: {
    user: User | null;
    session: Session | null;
    apiToken: ApiKey | null;
    plan: 'free' | 'pro' | 'enterprise';
    auth: ReturnType<typeof import('./auth').createAuth>;
  };
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;

export type OperationType = 'screenshot' | 'content' | 'markdown' | 'links' | 'pdf' | 'scrape' | 'search' | 'navigate';
