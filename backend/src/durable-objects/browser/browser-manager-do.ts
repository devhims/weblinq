import { DurableObject } from 'cloudflare:workers';

interface BrowserDO {
  id: string;
  status: 'idle' | 'busy' | 'error';
  lastActivity: number;
  created: number;
  sessionId?: string; // Cached browser session ID for instant access
  errorMessage?: string; // Store error details for debugging
  errorCount?: number; // Track consecutive errors for this DO
}

interface WaitingRequest {
  id: string;
  timestamp: number;
  resolve: (doId: string) => void;
  reject: (error: Error) => void;
}

/**
 * BrowserManagerDO - Orchestrates BrowserDO instances
 *
 * Simplified Architecture:
 * - Single source of truth for DO status tracking and assignment
 * - Creates DOs with meaningful names (e.g., "browser-123-abc") using idFromName()
 * - BrowserDOs self-identify using ctx.id.name (returns the original name string)
 * - No more initialize() coordination needed - IDs are automatically synchronized
 * - Focuses purely on orchestration: creating, assigning, and tracking DOs
 * - Cleanup and scaling logic centralized here
 * - Worker only communicates with Manager DO for all browser access
 */
export class BrowserManagerDO extends DurableObject<CloudflareBindings> {
  private readonly MAX_BROWSER_DOS = 10; // Maximum total DOs
  private readonly INACTIVE_CLEANUP_HOURS = 24; // Clean up DOs after 24 hours of inactivity
  private readonly CLEANUP_CHECK_INTERVAL = 60 * 60 * 1000; // Check every hour
  private readonly BROWSER_CREATION_DELAY = 5000; // 5 second delay between browser creations
  private readonly QUEUE_MAX_WAIT_TIME = 15000; // 15 seconds timeout

  // In-memory queue for waiting requests (faster than storage)
  private waitingRequests: Map<string, WaitingRequest> = new Map();

  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    console.log('BrowserManager: 🏗️ Constructor');
  }

  // Main method called by the worker to get an available Browser DO with fresh session ID
  async getAvailableBrowserDO(): Promise<{ id: string; sessionId: string }> {
    const operationStart = Date.now();

    // Get current DO statuses from memory (always fresh)
    const browserDOs = await this.getBrowserDOs();
    console.log(`BrowserManager: Retrieved ${browserDOs.length} DOs in ${Date.now() - operationStart}ms`);

    // Find an idle DO (including newly recovered ones)
    const availableDO = browserDOs.find((DO) => DO.status === 'idle');

    if (availableDO) {
      const assignmentStart = Date.now();
      console.log(
        `BrowserManager: Assigning idle DO: ${availableDO.id} with sessionId: ${availableDO.sessionId || 'pending'}`,
      );

      // OPTIMIZATION: Mark as busy and get session ID concurrently
      availableDO.status = 'busy';
      availableDO.lastActivity = Date.now();

      // Start both operations concurrently
      await this.updateBrowserDO(availableDO);

      // If we need a fresh session ID, wait for it and cache it

      console.log(`BrowserManager: Assignment completed in ${Date.now() - assignmentStart}ms`);
      return { id: availableDO.id, sessionId: availableDO.sessionId! };
    }

    // No idle DO available, check capacity atomically
    console.log('BrowserManager: No idle DOs available, checking capacity for new DO creation');

    // 🚨 CRITICAL SECTION: Check-then-act must be atomic to prevent race conditions
    const currentCount = browserDOs.length;
    if (currentCount < this.MAX_BROWSER_DOS) {
      console.log(`BrowserManager: Creating new DO (${currentCount}/${this.MAX_BROWSER_DOS})`);
      const newDO = await this.createNewBrowserDO();
      if (newDO) {
        console.log(`BrowserManager: ✅ Successfully created new DO: ${newDO.id}`);
        return { id: newDO.id, sessionId: newDO.sessionId! };
      }
    }

    console.log(`BrowserManager: Total operation time: ${Date.now() - operationStart}ms`);

    // At max capacity, use promise-based queue instead of polling
    console.log(`BrowserManager: At max capacity (${currentCount}/${this.MAX_BROWSER_DOS}), queueing request`);

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    return this.queueRequest(requestId);
  }

  private queueRequest(requestId: string): Promise<{ id: string; sessionId: string }> {
    return new Promise<{ id: string; sessionId: string }>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.waitingRequests.delete(requestId);
        reject(new Error(`Request timeout after ${this.QUEUE_MAX_WAIT_TIME}ms - all DOs are busy`));
      }, this.QUEUE_MAX_WAIT_TIME);

      // Queue the request
      this.waitingRequests.set(requestId, {
        id: requestId,
        timestamp: Date.now(),
        resolve: async (doId: string) => {
          // 1️⃣ Bail out if the timeout already fired and deleted the entry
          if (!this.waitingRequests.has(requestId)) {
            console.log(`BrowserManager: Request ${requestId} already fulfilled, ignoring`);
            return;
          }

          // 2️⃣ Normal success path
          clearTimeout(timeoutId);
          this.waitingRequests.delete(requestId);

          // Get the DO that was just freed up
          const currentBrowserDOs = await this.getBrowserDOs();
          const assignedDO = currentBrowserDOs.find((d) => d.id === doId);

          if (assignedDO) {
            console.log(`BrowserManager: Assigned queued request ${requestId} to DO: ${doId}`);
            resolve({ id: assignedDO.id, sessionId: assignedDO.sessionId! });
          } else {
            reject(new Error(`DO ${doId} not found when fulfilling queued request`));
          }
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          this.waitingRequests.delete(requestId);
          reject(error);
        },
      });

      console.log(`BrowserManager: Queued request ${requestId} (${this.waitingRequests.size} requests waiting)`);
    });
  }

  // Proactive browser creation endpoint - creates multiple browsers with staggered timing
  async createBrowsersBatch(count: number): Promise<{
    requested: number;
    created: number;
    skipped: number;
    details: Array<{ id: string; status: string; error?: string }>;
  }> {
    const browserDOs = await this.getBrowserDOs();
    const currentCount = browserDOs.length;
    const maxNew = this.MAX_BROWSER_DOS - currentCount;
    const actualCount = Math.min(count, maxNew);

    console.log(
      `BrowserManager: 🚀 Batch creation request - requested: ${count}, current: ${currentCount}, max: ${this.MAX_BROWSER_DOS}, will create: ${actualCount}`,
    );

    if (actualCount <= 0) {
      return {
        requested: count,
        created: 0,
        skipped: count,
        details: [
          {
            id: 'none',
            status: 'skipped',
            error: `At or above maximum capacity (${currentCount}/${this.MAX_BROWSER_DOS})`,
          },
        ],
      };
    }

    const results: Array<{ id: string; status: string; error?: string }> = [];
    let createdCount = 0;

    for (let i = 0; i < actualCount; i++) {
      try {
        // Create DO entry first
        const doId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

        console.log(`BrowserManager: Creating browser DO ${i + 1}/${actualCount}: ${doId}`);

        // await this.updateBrowserDO(newDO);

        // Initialize the Browser DO via RPC to create browser session
        const browserDo = this.env.BROWSER_DO.idFromName(doId);
        const browserStub = this.env.BROWSER_DO.get(browserDo);
        // await browserStub.setDoId(doId);

        // Trigger browser creation by requesting session ID and cache it
        const sessionId = await browserStub.generateSessionId(doId);
        if (sessionId) {
          const newDO: BrowserDO = {
            id: doId,
            status: 'idle',
            lastActivity: Date.now(),
            created: Date.now(),
            sessionId,
          };
          await this.updateBrowserDO(newDO);
        }

        results.push({
          id: doId,
          status: 'created',
        });
        createdCount++;

        console.log(`BrowserManager: ✅ Created browser DO: ${doId} (${createdCount}/${actualCount})`);

        // Add staggered delay between creations (except for the last one)
        if (i < actualCount - 1) {
          console.log(`BrowserManager: 🕒 Waiting ${this.BROWSER_CREATION_DELAY}ms before next creation...`);
          await new Promise((resolve) => setTimeout(resolve, this.BROWSER_CREATION_DELAY));
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`BrowserManager: ❌ Failed to create browser DO:`, error);
        results.push({
          id: `creation-${i}`,
          status: 'failed',
          error: errorMsg,
        });
      }
    }

    const skippedCount = count - actualCount;
    console.log(`BrowserManager: 🏁 Batch creation complete - created: ${createdCount}, skipped: ${skippedCount}`);

    return {
      requested: count,
      created: createdCount,
      skipped: skippedCount,
      details: results,
    };
  }

  // Called by Browser DOs to update their session ID when browser is created/refreshed
  async updateBrowserDOs(doId: string, sessionId: string, status: 'idle' | 'busy' | 'error'): Promise<void> {
    console.log(`BrowserManager: Updating session ID for DO ${doId}: ${sessionId}`);
    const browserDOs = await this.getBrowserDOs();
    const browserDO = browserDOs.find((DO) => DO.id === doId);

    if (browserDO) {
      console.log(
        `BrowserManager: Found DO ${doId}, updating session ID from ${browserDO.sessionId || 'none'} to ${sessionId}`,
      );
      browserDO.sessionId = sessionId;
      browserDO.status = status;
      browserDO.lastActivity = Date.now();
      await this.updateBrowserDO(browserDO);
      console.log(`BrowserManager: ✅ Session ID updated for DO ${doId}`);
    } else {
      console.log(`BrowserManager: ⚠️ DO ${doId} not found for session ID update, ignoring`);
    }
  }

  // Called by Browser DOs to update their status
  async updateDOStatus(doId: string, status: 'idle' | 'busy' | 'error', errorMessage?: string): Promise<void> {
    console.log(`BrowserManager: Updating DO ${doId} status to ${status}`);
    const browserDOs = await this.getBrowserDOs();
    console.log(`BrowserManager: Current tracked DOs: ${browserDOs.length}`);

    const browserDO = browserDOs.find((DO) => DO.id === doId);

    if (browserDO) {
      console.log(`BrowserManager: Found DO ${doId}, updating status from ${browserDO.status} to ${status}`);
      browserDO.status = status;
      browserDO.lastActivity = Date.now();

      // Handle error status updates
      if (status === 'error') {
        browserDO.errorMessage = errorMessage || 'Unknown error';
        browserDO.errorCount = (browserDO.errorCount || 0) + 1;
        console.log(
          `BrowserManager: ❌ DO ${doId} marked as error: ${browserDO.errorMessage} (error count: ${browserDO.errorCount})`,
        );

        // 🔄 Attempt recovery in the background without blocking the response
        this.ctx.waitUntil(this.attemptRecovery(browserDO));
      } else if (status === 'idle') {
        // Reset error info when DO becomes idle again
        if (browserDO.errorMessage) {
          console.log(`BrowserManager: ✅ DO ${doId} recovered from error state`);
          browserDO.errorMessage = undefined;
          browserDO.errorCount = 0;
        }
      }

      await this.updateBrowserDO(browserDO);
    } else {
      // Check if this is a hex ID (not created by BrowserManager)
      const isHexId = /^[a-f0-9]{64}$/.test(doId);

      if (isHexId) {
        console.log(
          `BrowserManager: ⚠️ Ignoring hex ID ${doId} - DO was not created by BrowserManager (likely ctx.id.name fallback)`,
        );
        return;
      }

      // Check if adding this DO would exceed MAX_BROWSER_DOS
      if (browserDOs.length >= this.MAX_BROWSER_DOS) {
        console.log(
          `BrowserManager: ⚠️ Cannot add DO ${doId} - would exceed MAX_BROWSER_DOS limit (${browserDOs.length}/${this.MAX_BROWSER_DOS})`,
        );
        return;
      }

      console.log(
        `BrowserManager: DO ${doId} not found in tracking, adding it (${browserDOs.length + 1}/${
          this.MAX_BROWSER_DOS
        })`,
      );
      const newDO: BrowserDO = {
        id: doId,
        status,
        lastActivity: Date.now(),
        created: Date.now(),
      };
      await this.updateBrowserDO(newDO);
    }

    // 🚀 Process queued requests when DO becomes idle
    if (status === 'idle' && this.waitingRequests.size > 0) {
      console.log(
        `BrowserManager: DO ${doId} became idle with ${this.waitingRequests.size} queued requests - assigning immediately`,
      );

      // Get the oldest waiting request (FIFO)
      const oldestRequest = this.waitingRequests.values().next().value;

      if (oldestRequest) {
        // Mark DO as busy before fulfilling request
        if (browserDO) {
          browserDO.status = 'busy';
          browserDO.lastActivity = Date.now();
          await this.updateBrowserDO(browserDO);
        }

        console.log(`BrowserManager: 🎯 Fulfilling queued request ${oldestRequest.id} with DO ${doId}`);

        // Fulfill the promise (this will resolve the createNewBrowserDO promise)
        oldestRequest.resolve(doId);
      }
    }
  }

  // Create a new Browser DO or queue request for when one becomes available (fallback)
  private async createNewBrowserDO(): Promise<BrowserDO | null> {
    const doId = `browser-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    console.log(`BrowserManager: Creating new Browser DO: ${doId}`);

    console.log(`BrowserManager: Getting fresh session ID from DO: ${doId}`);

    try {
      const browserDo = this.env.BROWSER_DO.idFromName(doId);
      const browserStub = this.env.BROWSER_DO.get(browserDo);

      const sessionId = await browserStub.generateSessionId(doId);

      if (!sessionId) {
        throw new Error(`No session ID returned from Browser DO: ${doId}`);
      }

      // Create DO tracking entry with 'busy' status (ready for immediate use)
      const newDO: BrowserDO = {
        id: doId,
        status: 'busy', // Ready to be assigned immediately
        lastActivity: Date.now(),
        created: Date.now(),
        sessionId,
      };

      await this.updateBrowserDO(newDO);
      console.log(`BrowserManager: Added new DO ${doId} to tracking with status: busy`);
      console.log(`BrowserManager: 🔍 Expected BrowserDO to self-identify as: ${doId}`);

      return newDO;
    } catch (error) {
      console.error(`BrowserManager: ❌ Failed to create new Browser DO:`, error);
      return null;
    }
  }

  // Get all Browser DO statuses
  private async getBrowserDOs(): Promise<BrowserDO[]> {
    const browserDOs = (await this.ctx.storage.get<Record<string, BrowserDO>>('browserDOs')) || {};
    const browserDOArray = Object.values(browserDOs);
    console.log(`BrowserManager: Retrieved ${browserDOArray.length} DOs from storage`);
    return browserDOArray;
  }

  // Update a single Browser DO
  private async updateBrowserDO(browserDO: BrowserDO): Promise<void> {
    const browserDOs = (await this.ctx.storage.get<Record<string, BrowserDO>>('browserDOs')) || {};
    browserDOs[browserDO.id] = browserDO;
    await this.ctx.storage.put('browserDOs', browserDOs);
    console.log(`BrowserManager: Stored DO ${browserDO.id} with status ${browserDO.status} to storage`);
  }

  // Remove a Browser DO from tracking with proper cleanup
  async removeBrowserDO(doId: string): Promise<void> {
    try {
      // First cleanup the BrowserDO properly
      console.log(`BrowserManager: 🧹 Cleaning up BrowserDO before removal: ${doId}`);
      const doReference = this.env.BROWSER_DO.idFromName(doId);
      const stub = this.env.BROWSER_DO.get(doReference);

      // Call cleanup method on the BrowserDO to terminate all resources
      await stub.cleanup(doId);
      console.log(`BrowserManager: ✅ BrowserDO cleanup completed for: ${doId}`);
    } catch (error) {
      console.error(`BrowserManager: ⚠️ Failed to cleanup BrowserDO ${doId}:`, error);
    }

    // Remove from tracking
    const statusData = (await this.ctx.storage.get<Record<string, BrowserDO>>('browserDOs')) || {};
    delete statusData[doId];
    await this.ctx.storage.put('browserDOs', statusData);
    console.log(`BrowserManager: ✅ Removed DO ${doId} from tracking`);
  }

  // Health check and stats
  async getStats(): Promise<{
    totalDOs: number;
    idleDOs: number;
    busyDOs: number;
    errorDOs: number;
    inactiveCleanupHours: number;
    queuedRequests: number;
    dos: Array<BrowserDO & { inactiveHours: number; willBeCleanedUp: boolean }>;
    note?: string;
  }> {
    const browserDOs = await this.getBrowserDOs();

    // Note: DOs will be created on-demand when needed via getAvailableBrowserDO()

    const now = Date.now();
    const INACTIVE_THRESHOLD = this.INACTIVE_CLEANUP_HOURS * 60 * 60 * 1000;

    // Add inactivity information to each DO
    const dosWithInactivity = browserDOs.map((doStatus) => {
      const inactiveTime = now - doStatus.lastActivity;
      const inactiveHours = Math.round((inactiveTime / (60 * 60 * 1000)) * 10) / 10;
      const willBeCleanedUp = inactiveTime > INACTIVE_THRESHOLD;

      return {
        ...doStatus,
        inactiveHours,
        willBeCleanedUp,
      };
    });

    return {
      totalDOs: browserDOs.length,
      idleDOs: browserDOs.filter((DO) => DO.status === 'idle').length,
      busyDOs: browserDOs.filter((DO) => DO.status === 'busy').length,
      errorDOs: browserDOs.filter((DO) => DO.status === 'error').length,
      inactiveCleanupHours: this.INACTIVE_CLEANUP_HOURS,
      queuedRequests: this.waitingRequests.size,
      dos: dosWithInactivity,
      note: browserDOs.length === 0 ? 'Development mode: DOs may reset between requests' : undefined,
    };
  }

  /* Attempt to refresh a DO that is in error state by requesting a new session ID */
  private async attemptRecovery(errorDO: BrowserDO): Promise<void> {
    const { id: doId } = errorDO;
    try {
      console.log(`BrowserManager: 🛠️ Attempting background recovery of DO ${doId}`);

      const browserDoRef = this.env.BROWSER_DO.idFromName(doId);
      const browserStub = this.env.BROWSER_DO.get(browserDoRef);

      const newSessionId: string | null = await browserStub.generateSessionId(doId);

      if (newSessionId) {
        console.log(`BrowserManager: ✅ Recovery succeeded for DO ${doId}, new session: ${newSessionId}`);

        // Update the DO record to idle with fresh session
        errorDO.status = 'idle';
        errorDO.sessionId = newSessionId;
        errorDO.lastActivity = Date.now();
        // keep error count, but clear error message to indicate recovered
        errorDO.errorMessage = undefined;
        errorDO.errorCount = 0;

        await this.updateBrowserDO(errorDO);

        // Immediately fulfil any queued request if there are any waiting
        if (this.waitingRequests.size > 0) {
          const oldestRequest = this.waitingRequests.values().next().value;
          if (oldestRequest) {
            console.log(`BrowserManager: 🎯 Assigning recovered DO ${doId} to queued request ${oldestRequest.id}`);
            oldestRequest.resolve(doId);
          }
        }
      } else {
        console.log(
          `BrowserManager: 🔄 Recovery attempt for DO ${doId} returned no session. Will stay in error state.`,
        );
      }
    } catch (err) {
      console.log(`BrowserManager: ⚠️ Recovery attempt failed for DO ${doId}:`, err);
    }
  }

  async getDoStatus(doId: string): Promise<'idle' | 'busy' | 'error' | 'unknown'> {
    const dos = await this.getBrowserDOs();
    return dos.find((d) => d.id === doId)?.status ?? 'unknown';
  }

  // Delete all Browser DOs - useful for deployment cleanup and resetting state
  async deleteAllBrowserDOs(): Promise<{
    action: string;
    message: string;
    totalFound: number;
    successCount: number;
    failureCount: number;
    details: Array<{
      id: string;
      status: string;
      success: boolean;
      message?: string;
      error?: string;
    }>;
    storageCleared: boolean;
  }> {
    console.log('BrowserManager: 🧹 Starting complete cleanup of all BrowserDOs');

    const browserDOs = await this.getBrowserDOs();
    const totalDOs = browserDOs.length;

    if (totalDOs === 0) {
      return {
        action: 'delete-all',
        message: 'No BrowserDOs found to delete',
        totalFound: 0,
        successCount: 0,
        failureCount: 0,
        details: [],
        storageCleared: true,
      };
    }

    console.log(`BrowserManager: Found ${totalDOs} BrowserDOs to delete`);

    const results = [];
    let successCount = 0;
    let failureCount = 0;

    // Clean up each BrowserDO properly
    for (const doStatus of browserDOs) {
      try {
        console.log(`BrowserManager: 🧹 Cleaning up BrowserDO: ${doStatus.id}`);
        await this.removeBrowserDO(doStatus.id);
        results.push({
          id: doStatus.id,
          status: doStatus.status,
          success: true,
          message: 'Successfully cleaned up and removed',
        });
        successCount++;
      } catch (error) {
        console.error(`BrowserManager: ❌ Failed to cleanup BrowserDO ${doStatus.id}:`, error);
        results.push({
          id: doStatus.id,
          status: doStatus.status,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }
    }

    // Double-check: Clear the entire browserDOs storage to ensure clean slate
    await this.ctx.storage.delete('browserDOs');
    console.log('BrowserManager: ✅ Cleared all BrowserDO references from storage');

    const response = {
      action: 'delete-all',
      message: `Deleted ${successCount} BrowserDOs successfully${failureCount > 0 ? `, ${failureCount} failures` : ''}`,
      totalFound: totalDOs,
      successCount,
      failureCount,
      details: results,
      storageCleared: true,
    };

    console.log(`BrowserManager: 🧹 Complete cleanup finished - ${successCount}/${totalDOs} successful`);

    return response;
  }

  // Debug endpoint to get detailed status of all browser DOs
  async getBrowserStatus(): Promise<{
    totalDOs: number;
    maxCapacity: number;
    queuedRequests: number;
    browserDOs: Array<{
      id: string;
      sessionId: string | null;
      status: 'idle' | 'busy' | 'error';
      errorMessage: string | null;
      errorCount: number;
      lastActivity: string; // Human readable timestamp
      created: string; // Human readable timestamp
      ageMinutes: number;
      inactiveMinutes: number;
    }>;
  }> {
    const browserDOs = await this.getBrowserDOs();
    const now = Date.now();

    const detailedBrowserDOs = browserDOs.map((browserDO) => {
      const ageMs = now - browserDO.created;
      const inactiveMs = now - browserDO.lastActivity;

      return {
        id: browserDO.id,
        sessionId: browserDO.sessionId || null,
        status: browserDO.status,
        errorMessage: browserDO.errorMessage || null,
        errorCount: browserDO.errorCount || 0,
        lastActivity: new Date(browserDO.lastActivity).toISOString(),
        created: new Date(browserDO.created).toISOString(),
        ageMinutes: Math.round((ageMs / (60 * 1000)) * 10) / 10,
        inactiveMinutes: Math.round((inactiveMs / (60 * 1000)) * 10) / 10,
      };
    });

    return {
      totalDOs: browserDOs.length,
      maxCapacity: this.MAX_BROWSER_DOS,
      queuedRequests: this.waitingRequests.size,
      browserDOs: detailedBrowserDOs,
    };
  }

  // Handle HTTP requests (for debugging/stats/maintenance)
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Strip /manager prefix if present (since requests come as /manager/*)
    const pathname = url.pathname;

    try {
      // GET /stats - Get current DO statistics
      if (pathname === '/stats') {
        const stats = await this.getStats();
        return new Response(JSON.stringify(stats, null, 2));
      }

      // GET /browser-status - Get detailed browser DO status for debugging
      if (pathname === '/browser-status') {
        const browserStatus = await this.getBrowserStatus();
        return new Response(JSON.stringify(browserStatus, null, 2));
      }

      // POST /create-browsers - Proactive browser creation with batch support
      if (pathname === '/create-browsers' && request.method === 'POST') {
        const body = await request.text();
        let count = 1; // default create 1 browser

        if (body) {
          try {
            const data = JSON.parse(body);
            if (data.count && typeof data.count === 'number' && data.count > 0) {
              count = Math.min(data.count, this.MAX_BROWSER_DOS); // Cap at max limit
            }
          } catch {
            // Use default if JSON parsing fails
          }
        }

        try {
          const result = await this.createBrowsersBatch(count);
          return new Response(JSON.stringify(result, null, 2));
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: 'Failed to create browsers',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
            { status: 500 },
          );
        }
      }

      // POST /cleanup-do - Clean up a specific BrowserDO
      if (pathname === '/cleanup-do' && request.method === 'POST') {
        const body = await request.text();
        let doId = '';

        if (body) {
          try {
            const data = JSON.parse(body);
            doId = data.doId || '';
          } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
          }
        }

        if (!doId) {
          return new Response(JSON.stringify({ error: 'Missing doId in request body' }), { status: 400 });
        }

        try {
          await this.removeBrowserDO(doId);
          return new Response(
            JSON.stringify({
              action: 'cleanup-do',
              doId,
              message: `Successfully cleaned up and removed BrowserDO: ${doId}`,
            }),
          );
        } catch (error) {
          return new Response(
            JSON.stringify({
              error: 'Failed to cleanup BrowserDO',
              doId,
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
            { status: 500 },
          );
        }
      }

      // POST /delete-all - Safely delete ALL BrowserDOs and clear storage
      if (pathname === '/delete-all' && request.method === 'POST') {
        try {
          console.log('BrowserManager: 🧹 Starting complete cleanup of all BrowserDOs');

          const browserDOs = await this.getBrowserDOs();
          const totalDOs = browserDOs.length;

          if (totalDOs === 0) {
            return new Response(
              JSON.stringify(
                {
                  action: 'delete-all',
                  message: 'No BrowserDOs found to delete',
                  deletedCount: 0,
                  details: [],
                },
                null,
                2,
              ),
            );
          }

          console.log(`BrowserManager: Found ${totalDOs} BrowserDOs to delete`);

          const results = [];
          let successCount = 0;
          let failureCount = 0;

          // Clean up each BrowserDO properly
          for (const doStatus of browserDOs) {
            try {
              console.log(`BrowserManager: 🧹 Cleaning up BrowserDO: ${doStatus.id}`);
              await this.removeBrowserDO(doStatus.id);
              results.push({
                id: doStatus.id,
                status: doStatus.status,
                success: true,
                message: 'Successfully cleaned up and removed',
              });
              successCount++;
            } catch (error) {
              console.error(`BrowserManager: ❌ Failed to cleanup BrowserDO ${doStatus.id}:`, error);
              results.push({
                id: doStatus.id,
                status: doStatus.status,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
              failureCount++;
            }
          }

          // Double-check: Clear the entire browserDOs storage to ensure clean slate
          await this.ctx.storage.delete('browserDOs');
          console.log('BrowserManager: ✅ Cleared all BrowserDO references from storage');

          const response = {
            action: 'delete-all',
            message: `Deleted ${successCount} BrowserDOs successfully${
              failureCount > 0 ? `, ${failureCount} failures` : ''
            }`,
            totalFound: totalDOs,
            successCount,
            failureCount,
            details: results,
            storageCleared: true,
          };

          console.log(`BrowserManager: 🧹 Complete cleanup finished - ${successCount}/${totalDOs} successful`);

          return new Response(JSON.stringify(response, null, 2));
        } catch (error) {
          console.error('BrowserManager: ❌ Delete-all operation failed:', error);
          return new Response(
            JSON.stringify({
              error: 'Failed to delete all BrowserDOs',
              message: error instanceof Error ? error.message : 'Unknown error',
            }),
            { status: 500 },
          );
        }
      }

      // GET / - Show available endpoints
      if (pathname === '/') {
        const endpoints = {
          message: 'Browser Manager DO - Available Endpoints',
          endpoints: {
            'GET /stats': 'Get current DO statistics (includes inactivity info and error DOs)',
            'GET /browser-status':
              'Get detailed status of all browser DOs for debugging (includes session IDs, error counts, etc.)',
            'POST /create-browsers':
              'Proactively create multiple browsers with staggered timing (optional: {"count": 3}) - NEW RECOMMENDED ENDPOINT',
            'POST /cleanup-do': 'Clean up a specific BrowserDO (required: {"doId": "browser-xxx"})',
            'POST /delete-all': '⚠️  DESTRUCTIVE: Safely delete ALL BrowserDOs and clear all storage (clean slate)',
          },
          config: {
            inactiveCleanupHours: this.INACTIVE_CLEANUP_HOURS,
            cleanupCheckInterval: `${this.CLEANUP_CHECK_INTERVAL / (60 * 1000)} minutes`,
            browserCreationDelay: `${this.BROWSER_CREATION_DELAY / 1000} seconds`,
            maxBrowserDOs: this.MAX_BROWSER_DOS,
          },
        };
        return new Response(JSON.stringify(endpoints, null, 2));
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('BrowserManager fetch error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500 },
      );
    }
  }
}
