import { DurableObject } from 'cloudflare:workers';
import { and, eq } from 'drizzle-orm';

import type {
  insertTasksSchema,
  patchTasksSchema,
  publicTaskSchema,
} from '@/db/schema';
import type { z } from '@hono/zod-openapi';

import { createDb } from '@/db';
import { tasks } from '@/db/schema';

export interface Env {
  D1_DB: D1Database;
  NODE_ENV?: string;
}

export class TaskDurableObject extends DurableObject {
  private userId: string;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);

    // The Durable Object ID will be derived from the user ID
    // We'll extract the user ID from the object name when creating the stub
    this.userId = '';
  }

  /**
   * Initialize the Durable Object with user context
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
  }

  /**
   * Helper function to serialize task objects for public API
   */
  private serializeTask(task: any): z.infer<typeof publicTaskSchema> {
    return {
      id: task.id,
      name: task.name,
      done: task.done,
      createdAt: task.createdAt ? task.createdAt.toISOString() : null,
      updatedAt: task.updatedAt ? task.updatedAt.toISOString() : null,
    };
  }

  /**
   * List all tasks for the user
   */
  async listTasks(): Promise<z.infer<typeof publicTaskSchema>[]> {
    const db = createDb(this.env as any);

    // Filter tasks by userId to ensure data isolation
    const userTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, this.userId));

    return userTasks.map((task) => this.serializeTask(task));
  }

  /**
   * Create a new task for the user
   */
  async createTask(
    taskData: z.infer<typeof insertTasksSchema>,
  ): Promise<z.infer<typeof publicTaskSchema>> {
    const db = createDb(this.env as any);

    // Add userId to the task data
    const taskWithUserId = {
      ...taskData,
      userId: this.userId,
    };

    const [inserted] = await db
      .insert(tasks)
      .values(taskWithUserId)
      .returning();
    return this.serializeTask(inserted);
  }

  /**
   * Get a specific task by ID for the user
   */
  async getTask(id: number): Promise<z.infer<typeof publicTaskSchema> | null> {
    const db = createDb(this.env as any);

    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, this.userId)))
      .limit(1);

    return task ? this.serializeTask(task) : null;
  }

  /**
   * Update a task for the user
   */
  async updateTask(
    id: number,
    updates: z.infer<typeof patchTasksSchema>,
  ): Promise<z.infer<typeof publicTaskSchema> | null> {
    const db = createDb(this.env as any);

    if (Object.keys(updates).length === 0) {
      throw new Error('No updates provided');
    }

    // Only update tasks that belong to this user
    const [task] = await db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.id, id), eq(tasks.userId, this.userId)))
      .returning();

    return task ? this.serializeTask(task) : null;
  }

  /**
   * Delete a task for the user
   */
  async deleteTask(id: number): Promise<boolean> {
    const db = createDb(this.env as any);

    // Only delete tasks that belong to this user
    const result = await db
      .delete(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, this.userId)));

    return result.meta.changes > 0;
  }

  /**
   * Get task statistics for the user
   */
  async getTaskStats(): Promise<{
    total: number;
    completed: number;
    pending: number;
  }> {
    const db = createDb(this.env as any);

    const userTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, this.userId));

    const total = userTasks.length;
    const completed = userTasks.filter((task) => task.done).length;
    const pending = total - completed;

    return { total, completed, pending };
  }
}
