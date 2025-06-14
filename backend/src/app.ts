import configureOpenAPI from '@/lib/configure-open-api';
import createApp from '@/lib/create-app';
import apiKeys from '@/routes/api-keys/api-keys.index';
import demo from '@/routes/demo/demo.index';
import index from '@/routes/index.route';
import tasks from '@/routes/tasks/tasks.index';
import user from '@/routes/user/user.index';
import web from '@/routes/web/web.index';

const app = createApp();

configureOpenAPI(app);

const routes = [index, tasks, user, demo, apiKeys, web] as const;

routes.forEach((route) => {
  app.route('/', route);
});

export type AppType = (typeof routes)[number];

// Export the Durable Object classes for Cloudflare Workers runtime
export { TaskDurableObject } from '@/durable-objects/task-durable-object';
export { WebDurableObject } from '@/durable-objects/web-durable-object';

export default app;
