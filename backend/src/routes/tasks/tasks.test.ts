import {
  afterAll,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
} from 'vitest';
import { ZodIssueCode } from 'zod';

import { ZOD_ERROR_CODES, ZOD_ERROR_MESSAGES } from '@/lib/constants';

// Test API key - should be provided as environment variable

const TEST_API_KEY = process.env.TEST_API_KEY;

if (!TEST_API_KEY) {
  throw new Error(
    'TEST_API_KEY environment variable is required. Please provide a valid API key for testing.\n' +
      'Run: TEST_API_KEY=your-api-key-here npm run test:tasks\n' +
      'Make sure wrangler dev --remote is running on port 8787',
  );
}

const BASE_URL = 'http://localhost:8787';
const authHeaders = {
  Authorization: `Bearer ${TEST_API_KEY}`,
  'Content-Type': 'application/json',
};

// Helper function to make HTTP requests
async function makeRequest(path: string, options: RequestInit = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...options.headers,
    },
  });
  return response;
}

describe('tasks API - Integration Tests with Remote D1', () => {
  beforeEach(async () => {
    // Clean up test tasks before each test
    try {
      const response = await makeRequest('/tasks');
      if (response.status === 200) {
        const tasks = (await response.json()) as any[];
        const testTasks = tasks.filter((task: any) =>
          task.name.startsWith('TEST_'),
        );

        // Delete all test tasks
        for (const task of testTasks) {
          await makeRequest(`/tasks/${task.id}`, {
            method: 'DELETE',
          });
        }
      }
    } catch (error) {
      console.warn('Could not clean up test tasks in beforeEach:', error);
    }
  });

  afterAll(async () => {
    // Final cleanup - remove any remaining test tasks
    try {
      const response = await makeRequest('/tasks');
      if (response.status === 200) {
        const tasks = (await response.json()) as any[];
        const testTasks = tasks.filter((task: any) =>
          task.name.startsWith('TEST_'),
        );

        for (const task of testTasks) {
          await makeRequest(`/tasks/${task.id}`, {
            method: 'DELETE',
          });
        }
      }
    } catch (error) {
      console.warn('Could not clean up test tasks in afterAll:', error);
    }
  });

  describe('authentication Tests', () => {
    it('should reject requests without authentication', async () => {
      const response = await fetch(`${BASE_URL}/tasks`);
      expect(response.status).toBe(401);

      const json = (await response.json()) as any;
      expect(json.message).toContain('session or API key required');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await fetch(`${BASE_URL}/tasks`, {
        headers: {
          Authorization: 'Bearer invalid-api-key-12345',
          'Content-Type': 'application/json',
        },
      });
      expect(response.status).toBe(401);

      const json = (await response.json()) as any;
      expect(json.message).toContain('session or API key required');
    });

    it('should accept requests with valid API key', async () => {
      const response = await makeRequest('/tasks');
      expect(response.status).toBe(200);
    });
  });

  describe('task CRUD Operations', () => {
    describe('pOST /tasks - Create Task', () => {
      it('should validate required fields', async () => {
        const response = await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            done: false,
            // missing required 'name' field
          }),
        });

        expect(response.status).toBe(422);

        const json = (await response.json()) as any;
        expect(json.error.issues[0].path[0]).toBe('name');
        expect(json.error.issues[0].message).toBe(ZOD_ERROR_MESSAGES.REQUIRED);
      });

      it('should validate name length', async () => {
        const response = await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            name: '', // empty name should fail
            done: false,
          }),
        });

        expect(response.status).toBe(422);

        const json = (await response.json()) as any;
        expect(json.error.issues[0].path[0]).toBe('name');
        expect(json.error.issues[0].code).toBe(ZodIssueCode.too_small);
      });

      it('should create a task with valid data', async () => {
        const taskName = 'TEST_Learn vitest with authentication';
        const response = await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            name: taskName,
            done: false,
          }),
        });

        expect(response.status).toBe(200);

        const json = (await response.json()) as any;
        expect(json.name).toBe(taskName);
        expect(json.done).toBe(false);
        expect(json.id).toBeDefined();
        expect(json.createdAt).toBeDefined();
        expect(json.updatedAt).toBeDefined();
        // Should not include userId in response (security)
        expect(json).not.toHaveProperty('userId');
      });

      it('should create a task with done field omitted (defaults to false)', async () => {
        const response = await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            name: 'TEST_Task with default done status',
          }),
        });

        expect(response.status).toBe(200);

        const json = (await response.json()) as any;
        expect(json.done).toBe(false);
      });
    });

    describe('gET /tasks - List Tasks', () => {
      it('should list all tasks for the authenticated user', async () => {
        // First create a few test tasks
        await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({ name: 'TEST_Task 1', done: false }),
        });
        await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({ name: 'TEST_Task 2', done: true }),
        });

        const response = await makeRequest('/tasks');

        expect(response.status).toBe(200);

        const json = (await response.json()) as any[];
        expectTypeOf(json).toBeArray();

        // Filter to only test tasks to avoid interference with existing data
        const testTasks = json.filter((task: any) =>
          task.name.startsWith('TEST_'),
        );
        expect(testTasks.length).toBeGreaterThanOrEqual(2);

        // Check that each task has the correct structure
        testTasks.forEach((task: any) => {
          expect(task.id).toBeDefined();
          expect(task.name).toBeDefined();
          expect(task.done).toBeDefined();
          expect(task.createdAt).toBeDefined();
          expect(task.updatedAt).toBeDefined();
          // Should not include userId in response
          expect(task).not.toHaveProperty('userId');
        });
      });
    });

    describe('gET /tasks/:id - Get Specific Task', () => {
      it('should validate ID parameter', async () => {
        const response = await makeRequest('/tasks/not-a-number');

        expect(response.status).toBe(422);

        const json = (await response.json()) as any;
        expect(json.error.issues[0].path[0]).toBe('id');
        expect(json.error.issues[0].message).toBe(
          ZOD_ERROR_MESSAGES.EXPECTED_NUMBER,
        );
      });

      it('should return 404 when task not found', async () => {
        const response = await makeRequest('/tasks/999999');

        expect(response.status).toBe(404);

        const json = (await response.json()) as any;
        expect(json.message).toBe('Not Found');
      });

      it('should return specific task when it exists', async () => {
        // Create a task first
        const createResponse = await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({ name: 'TEST_Specific Task', done: false }),
        });

        expect(createResponse.status).toBe(200);
        const createdTask = (await createResponse.json()) as any;

        const response = await makeRequest(`/tasks/${createdTask.id}`);

        expect(response.status).toBe(200);

        const json = (await response.json()) as any;
        expect(json.id).toBe(createdTask.id);
        expect(json.name).toBe('TEST_Specific Task');
        expect(json.done).toBe(false);
      });
    });

    describe('pATCH /tasks/:id - Update Task', () => {
      it('should validate empty update body', async () => {
        const response = await makeRequest('/tasks/1', {
          method: 'PATCH',
          body: JSON.stringify({}),
        });

        expect(response.status).toBe(422);

        const json = (await response.json()) as any;
        expect(json.error.issues[0].code).toBe(ZOD_ERROR_CODES.INVALID_UPDATES);
        expect(json.error.issues[0].message).toBe(
          ZOD_ERROR_MESSAGES.NO_UPDATES,
        );
      });

      it('should update a task with valid data', async () => {
        // First create a task
        const createResponse = await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            name: 'TEST_Task to update',
            done: false,
          }),
        });

        expect(createResponse.status).toBe(200);
        const createdTask = (await createResponse.json()) as any;

        // Now update it
        const updateResponse = await makeRequest(`/tasks/${createdTask.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            done: true,
          }),
        });

        expect(updateResponse.status).toBe(200);

        const updatedTask = (await updateResponse.json()) as any;
        expect(updatedTask.done).toBe(true);
        expect(updatedTask.id).toBe(createdTask.id);
        expect(updatedTask.name).toBe('TEST_Task to update');
      });

      it('should update task name', async () => {
        // Create a task
        const createResponse = await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({ name: 'TEST_Original Name', done: false }),
        });

        expect(createResponse.status).toBe(200);
        const createdTask = (await createResponse.json()) as any;

        // Update the name
        const updateResponse = await makeRequest(`/tasks/${createdTask.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: 'TEST_Updated Name' }),
        });

        expect(updateResponse.status).toBe(200);

        const updatedTask = (await updateResponse.json()) as any;
        expect(updatedTask.name).toBe('TEST_Updated Name');
        expect(updatedTask.done).toBe(false); // Should remain unchanged
      });
    });

    describe('dELETE /tasks/:id - Delete Task', () => {
      it('should delete a task', async () => {
        // First create a task
        const createResponse = await makeRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify({
            name: 'TEST_Task to delete',
            done: false,
          }),
        });

        expect(createResponse.status).toBe(200);
        const createdTask = (await createResponse.json()) as any;

        // Now delete it
        const deleteResponse = await makeRequest(`/tasks/${createdTask.id}`, {
          method: 'DELETE',
        });

        expect(deleteResponse.status).toBe(204);

        // Verify it's deleted by trying to get it
        const getResponse = await makeRequest(`/tasks/${createdTask.id}`);

        expect(getResponse.status).toBe(404);
      });

      it('should return 404 when trying to delete non-existent task', async () => {
        const response = await makeRequest('/tasks/999999', {
          method: 'DELETE',
        });

        expect(response.status).toBe(404);
      });
    });
  });

  describe('data Integrity Tests', () => {
    it('should maintain task count across operations', async () => {
      // Get initial count of test tasks
      let response = await makeRequest('/tasks');
      expect(response.status).toBe(200);

      let tasks = (await response.json()) as any[];
      const initialTestTaskCount = tasks.filter((task: any) =>
        task.name.startsWith('TEST_'),
      ).length;

      // Create 3 test tasks
      await makeRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({ name: 'TEST_Count Task 1', done: false }),
      });
      await makeRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({ name: 'TEST_Count Task 2', done: true }),
      });
      await makeRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify({ name: 'TEST_Count Task 3', done: false }),
      });

      // Verify count increased by 3
      response = await makeRequest('/tasks');
      expect(response.status).toBe(200);

      tasks = (await response.json()) as any[];
      const finalTestTaskCount = tasks.filter((task: any) =>
        task.name.startsWith('TEST_'),
      ).length;
      expect(finalTestTaskCount).toBe(initialTestTaskCount + 3);
    });

    it('should preserve task data through update operations', async () => {
      // Create a task with specific data
      const originalData = {
        name: 'TEST_Important Task',
        done: false,
      };

      const createResponse = await makeRequest('/tasks', {
        method: 'POST',
        body: JSON.stringify(originalData),
      });

      expect(createResponse.status).toBe(200);
      const createdTask = (await createResponse.json()) as any;
      const originalCreatedAt = createdTask.createdAt;

      // Update only the done status
      const updateResponse = await makeRequest(`/tasks/${createdTask.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ done: true }),
      });

      expect(updateResponse.status).toBe(200);
      const updatedTask = (await updateResponse.json()) as any;

      // Verify that only done status changed
      expect(updatedTask.done).toBe(true);
      expect(updatedTask.name).toBe(originalData.name);
      expect(updatedTask.id).toBe(createdTask.id);
      expect(updatedTask.createdAt).toBe(originalCreatedAt);
      expect(updatedTask.updatedAt).not.toBe(originalCreatedAt);
    });
  });
});
