import { and, eq } from 'drizzle-orm';
import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import type { publicTaskSchema } from '@/db/schema';
import type { AppRouteHandler } from '@/lib/types';
import type { z } from '@hono/zod-openapi';

import { createDb } from '@/db';
import { tasks } from '@/db/schema';
import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';

import type {
  CreateRoute,
  GetOneRoute,
  ListRoute,
  PatchRoute,
  RemoveRoute,
} from './tasks.routes';

/**
 * Helper function to serialize task objects for public API
 */
function serializeTask(task: any): z.infer<typeof publicTaskSchema> {
  return {
    id: task.id,
    name: task.name,
    done: task.done,
    createdAt: task.createdAt ? task.createdAt.toISOString() : null,
    updatedAt: task.updatedAt ? task.updatedAt.toISOString() : null,
  };
}

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists
  const db = createDb(c.env);

  // Filter tasks by userId to ensure data isolation
  const userTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, user.id));

  return c.json(userTasks.map((task) => serializeTask(task)));
};

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists
  const taskData = c.req.valid('json');
  const db = createDb(c.env);

  // Add userId to the task data
  const taskWithUserId = {
    ...taskData,
    userId: user.id,
  };

  const [inserted] = await db.insert(tasks).values(taskWithUserId).returning();
  return c.json(serializeTask(inserted), HttpStatusCodes.OK);
};

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists
  const { id } = c.req.valid('param');
  const db = createDb(c.env);

  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, Number(id)), eq(tasks.userId, user.id)))
    .limit(1);

  if (!task) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return c.json(serializeTask(task), HttpStatusCodes.OK);
};

export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists
  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');
  const db = createDb(c.env);

  if (Object.keys(updates).length === 0) {
    return c.json(
      {
        success: false,
        error: {
          issues: [
            {
              code: ZOD_ERROR_CODES.INVALID_UPDATES,
              path: [],
              message: ZOD_ERROR_MESSAGES.NO_UPDATES,
            },
          ],
          name: 'ZodError',
        },
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY,
    );
  }

  // Only update tasks that belong to this user
  const [task] = await db
    .update(tasks)
    .set(updates)
    .where(and(eq(tasks.id, Number(id)), eq(tasks.userId, user.id)))
    .returning();

  if (!task) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return c.json(serializeTask(task), HttpStatusCodes.OK);
};

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists
  const { id } = c.req.valid('param');
  const db = createDb(c.env);

  // Only delete tasks that belong to this user
  const result = await db
    .delete(tasks)
    .where(and(eq(tasks.id, Number(id)), eq(tasks.userId, user.id)));

  if (result.meta.changes === 0) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
