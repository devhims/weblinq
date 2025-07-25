import type { OpenAPIHono, RouteConfig, RouteHandler } from '@hono/zod-openapi';

export interface AppBindings {
  Bindings: CloudflareBindings;
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<
  R,
  AppBindings
>;

export type OperationType =
  | 'screenshot'
  | 'content'
  | 'markdown'
  | 'links'
  | 'pdf'
  | 'scrape'
  | 'search'
  | 'navigate';
