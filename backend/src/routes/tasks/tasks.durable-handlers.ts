import * as HttpStatusCodes from 'stoker/http-status-codes';
import * as HttpStatusPhrases from 'stoker/http-status-phrases';

import type { TaskDurableObject } from '@/durable-objects/task-durable-object';
import type { AppRouteHandler } from '@/lib/types';

import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';

import type {
  CreateRoute,
  GetOneRoute,
  ListRoute,
  PatchRoute,
  RemoveRoute,
} from './tasks.routes';

/**
 * Helper function to get the TaskDurableObject stub for a user
 */
function getTaskDurableObject(
  c: any,
  userId: string,
): DurableObjectStub<TaskDurableObject> {
  // Get the Durable Object namespace from the environment
  const namespace = c.env.TASK_DURABLE_OBJECT;

  // Create a unique ID for this user's tasks
  const id = namespace.idFromName(`user:${userId}`);

  // Get the stub
  const stub = namespace.get(id);

  return stub;
}

/**
 * List all tasks for the authenticated user
 */
export const list: AppRouteHandler<ListRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists

  const stub = getTaskDurableObject(c, user.id);

  // Initialize the Durable Object with user context
  await stub.initialize(user.id);

  // Get tasks from the Durable Object
  const tasks = await stub.listTasks();

  return c.json(tasks);
};

/**
 * Create a new task for the authenticated user
 */
export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists

  const taskData = c.req.valid('json');
  const stub = getTaskDurableObject(c, user.id);

  // Initialize the Durable Object with user context
  await stub.initialize(user.id);

  // Create task in the Durable Object
  const createdTask = await stub.createTask(taskData);

  return c.json(createdTask, HttpStatusCodes.OK);
};

/**
 * Get a specific task by ID for the authenticated user
 */
export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists

  const { id } = c.req.valid('param');
  const stub = getTaskDurableObject(c, user.id);

  // Initialize the Durable Object with user context
  await stub.initialize(user.id);

  // Get task from the Durable Object
  const task = await stub.getTask(Number(id));

  if (!task) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return c.json(task, HttpStatusCodes.OK);
};

/**
 * Update a task for the authenticated user
 */
export const patch: AppRouteHandler<PatchRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists

  const { id } = c.req.valid('param');
  const updates = c.req.valid('json');

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

  const stub = getTaskDurableObject(c, user.id);

  // Initialize the Durable Object with user context
  await stub.initialize(user.id);

  // Update task in the Durable Object
  const updatedTask = await stub.updateTask(Number(id), updates);

  if (!updatedTask) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return c.json(updatedTask, HttpStatusCodes.OK);
};

/**
 * Delete a task for the authenticated user
 */
export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const user = c.get('user')!; // Auth middleware ensures user exists

  const { id } = c.req.valid('param');
  const stub = getTaskDurableObject(c, user.id);

  // Initialize the Durable Object with user context
  await stub.initialize(user.id);

  // Delete task from the Durable Object
  const deleted = await stub.deleteTask(Number(id));

  if (!deleted) {
    return c.json(
      {
        message: HttpStatusPhrases.NOT_FOUND,
      },
      HttpStatusCodes.NOT_FOUND,
    );
  }

  return c.body(null, HttpStatusCodes.NO_CONTENT);
};
