import { Hono } from 'hono';

import type { ExecutionContext } from '@cloudflare/workers-types';

import puppeteer, { connect } from '@cloudflare/puppeteer';

// Note: SearchDO still exists for backward compatibility but is not exported
import { BrowserDO } from './browser-do';
// Import operation handlers directly
// import { SearchHandler } from './handlers/search-handler';
// import { ScreenshotHandler } from './handlers/screenshot-handler';
// import { MarkdownHandler } from './handlers/markdown-handler';
// import { HtmlHandler } from './handlers/html-handler';
// import { SearchDO } from './search-do';
import { BrowserManagerDO } from './browser-manager-do';

const app = new Hono<{ Bindings: CloudflareBindings }>();

// Initialize operation handlers
// const searchHandler = new SearchHandler();
// const screenshotHandler = new ScreenshotHandler();
// const markdownHandler = new MarkdownHandler();
// const htmlHandler = new HtmlHandler();

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function hardenPage(page: any) {
  await page.setUserAgent(UA);

  // webdriver = undefined
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4] });
  });

  await page.setViewport({ width: 1920, height: 1080 });
}

// Test a single browser connection
async function testBrowserConnection(
  env: CloudflareBindings,
  sessionId: string,
): Promise<{ browser: any; version: string; versionTime: number }> {
  console.log(`Worker: Testing browser connection for session: ${sessionId}`);

  const browser = await connect(env.BROWSER, sessionId);

  if (!browser) {
    throw new Error('Browser connection returned null');
  }

  // Measure how long the version check takes
  const versionStart = Date.now();
  const version = await browser.version();
  const versionTime = Date.now() - versionStart;

  console.log(
    `Worker: ✅ Browser connection test successful (${version}) in ${versionTime}ms`,
  );
  return { browser, version, versionTime };
}

// Connect to browser session with retry logic for failed DOs
async function connectSessionWithRetry(
  env: CloudflareBindings,
  managerStub: any,
  maxAttempts = 5,
): Promise<{
  browser: any;
  browserDoId: string;
  sessionId: string;
  connectionAttempts: number;
  browserConnected: boolean;
  versionTime: number;
}> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `Worker: Attempt ${attempt}/${maxAttempts} - Getting available Browser DO`,
      );

      // Get an available Browser DO with fresh session ID from Manager
      const { id: browserDoId, sessionId } =
        await managerStub.getAvailableBrowserDO();
      console.log(
        `Worker: Assigned BrowserDO: ${browserDoId} with session ID: ${sessionId}`,
      );

      // Test browser connection
      try {
        const { browser, versionTime } = await testBrowserConnection(
          env,
          sessionId,
        );

        console.log(
          `Worker: ✅ Browser connection established after ${attempt} attempts`,
        );
        return {
          browser,
          browserDoId,
          sessionId,
          connectionAttempts: attempt,
          browserConnected: true,
          versionTime,
        };
      } catch (connectionError) {
        const errorMessage =
          connectionError instanceof Error
            ? connectionError.message
            : String(connectionError);

        console.log(
          `Worker: ❌ Browser connection test failed for DO ${browserDoId}: ${errorMessage}`,
        );

        // Mark this DO as error and try to get another one
        try {
          await updateDOStatusWithRetry(
            managerStub,
            browserDoId,
            'error',
            3,
            `Connection test failed: ${errorMessage}`,
          );
          console.log(
            `Worker: Marked DO ${browserDoId} as error due to connection failure`,
          );
        } catch (updateError) {
          console.error(
            `Worker: Failed to mark DO ${browserDoId} as error: ${updateError}`,
          );
        }

        // If this was the last attempt, throw the error
        if (attempt === maxAttempts) {
          throw new Error(
            `Failed to establish browser connection after ${maxAttempts} attempts. Last error: ${errorMessage}`,
          );
        }

        console.log(
          `Worker: Attempting to get another idle DO (attempt ${
            attempt + 1
          }/${maxAttempts})`,
        );

        // Exponential backoff delay before next attempt
        const backoff = 200 * 2 ** (attempt - 1); // 200ms, 400ms, 800ms, 1600ms
        console.log(
          `Worker: Waiting ${backoff}ms before next connection attempt...`,
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    } catch (doAllocationError) {
      // Handle errors from getAvailableBrowserDO (e.g., no idle DOs available, queueing)
      if (
        doAllocationError instanceof Error &&
        doAllocationError.message.includes('timeout')
      ) {
        console.log(
          `Worker: No idle DOs available, request was queued and timed out`,
        );
        throw doAllocationError; // Let the queue timeout bubble up
      }

      console.error(
        `Worker: Failed to get available Browser DO on attempt ${attempt}:`,
        doAllocationError,
      );

      // If this was the last attempt, re-throw
      if (attempt === maxAttempts) {
        throw doAllocationError;
      }

      // Exponential backoff delay before retrying DO allocation
      const backoff = 200 * 2 ** (attempt - 1);
      console.log(
        `Worker: Waiting ${backoff}ms before retrying DO allocation...`,
      );
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw new Error(`Exhausted all ${maxAttempts} connection attempts`);
}

// Simplified operation execution - Manager DO handles all coordination
async function executeOperation<T>(
  env: CloudflareBindings,
  ctx: ExecutionContext,
  operation: (page: any) => Promise<T>,
  timeout = 15000, // 15 seconds
): Promise<T> {
  const timings = {
    start: Date.now(),
    doAllocation: 0,
    browserSetup: 0,
    searchExecution: 0,
    cleanup: 0,
    connectionRetries: 0,
  };

  const managerId = env.BROWSER_MANAGER_DO.idFromName('global');
  const managerStub = env.BROWSER_MANAGER_DO.get(managerId);

  let page: any = null;
  let operationSuccessful = false;

  // Step 1: Connect to browser session with retry logic
  const connectionStart = Date.now();
  const {
    browser,
    browserDoId,
    sessionId,
    connectionAttempts,
    browserConnected,
    versionTime,
  } = await connectSessionWithRetry(env, managerStub);

  timings.doAllocation = Date.now() - connectionStart;
  timings.connectionRetries = connectionAttempts - 1;

  try {
    // Step 2: Browser setup (create page and prepare for operation)
    const browserStart = Date.now();

    page = await browser.newPage();
    console.log(`Worker: Created new page for operation`);

    await hardenPage(page);

    timings.browserSetup = Date.now() - browserStart;
    console.log(`Worker: Browser setup complete (${timings.browserSetup}ms)`);

    // Step 3: Execute the operation
    const searchStart = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeout}ms`)),
        timeout,
      ),
    );

    const result = await Promise.race([operation(page), timeoutPromise]);
    timings.searchExecution = Date.now() - searchStart;
    console.log(`Worker: Operation completed (${timings.searchExecution}ms)`);

    // Add debug information to result
    if (typeof result === 'object' && result !== null && 'debug' in result) {
      (result as any).debug.browserConnected = browserConnected;
      (result as any).debug.connectionAttempts = connectionAttempts;
      (result as any).debug.connectionRetries = timings.connectionRetries;
      (result as any).debug.timings = timings;
      (result as any).debug.browserTimings = {
        connect: timings.doAllocation,
        version: typeof versionTime === 'number' ? versionTime : 0,
        newPage: timings.browserSetup,
      };
    }

    operationSuccessful = true;
    return result as T;
  } catch (operationError) {
    // Mark the DO as 'error' if the operation fails
    const errorMessage =
      operationError instanceof Error
        ? operationError.message
        : String(operationError);
    console.error(
      `Worker: Operation failed for DO ${browserDoId}: ${errorMessage}`,
    );

    try {
      ctx.waitUntil(
        updateDOStatusWithRetry(
          managerStub,
          browserDoId,
          'error',
          3,
          errorMessage,
        ),
      );
    } catch (updateError) {
      console.error(
        `Worker: Failed to mark DO ${browserDoId} as error: ${updateError}`,
      );
    }

    throw operationError;
  } finally {
    // Step 4: Cleanup
    const cleanupStart = Date.now();

    if (page && !page.isClosed()) {
      try {
        await page.close();
        console.log(`Worker: Page closed`);
      } catch (error) {
        console.log(`Worker: ⚠️ Failed to close page: ${error}`);
      }
    }

    if (browser) {
      try {
        (browser as any).disconnect();
        console.log(`Worker: Disconnected from browser (session kept alive)`);
      } catch (error) {
        console.log(`Worker: ⚠️ Failed to disconnect: ${error}`);
      }
    }

    // Only mark as idle if operation was successful
    if (operationSuccessful) {
      try {
        ctx.waitUntil(
          updateDOStatusWithRetry(managerStub, browserDoId, 'idle'),
        );
      } catch (statusUpdateError) {
        console.error(
          `Worker: Failed to update DO status to idle: ${statusUpdateError}`,
        );
      }
    }

    timings.cleanup = Date.now() - cleanupStart;
    const totalTime = Date.now() - timings.start;

    console.log(
      `Worker: Cleanup complete (${timings.cleanup}ms) | Total: ${totalTime}ms`,
    );
    console.log(
      `Worker: Timing breakdown - DO:${timings.doAllocation}ms | Browser:${timings.browserSetup}ms | Operation:${timings.searchExecution}ms | Cleanup:${timings.cleanup}ms | Retries:${timings.connectionRetries}`,
    );
  }
}

async function updateDOStatusWithRetry(
  managerStub: any,
  browserDoId: string,
  status: 'idle' | 'busy' | 'error',
  maxAttempts = 3,
  errorMessage?: string,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await managerStub.updateDOStatus(browserDoId, status, errorMessage);
      console.log(
        `Worker: DO ${browserDoId} marked ${status}${
          errorMessage ? ` (${errorMessage})` : ''
        }`,
      );
      return;
    } catch (err) {
      if (attempt === maxAttempts) throw err;
      const backoff = 200 * 2 ** (attempt - 1); // 200 ms, 400 ms, 800 ms
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

// Browser-based search - worker controls everything locally
// app.get('/browser/search', async (c) => {
//   const query = c.req.query('q');
//   if (!query) return c.text('Missing ?q= parameter', 400);

//   try {
//     const result = await executeOperation(
//       c.env,
//       c.executionCtx as ExecutionContext,
//       async (page) => {
//         // Worker handles the operation completely
//         return await searchHandler.handleSearchRequest(page, query);
//       },
//     );

//     // Create response with timing headers for bottleneck analysis
//     const response = c.json({
//       operation: 'search',
//       ...result,
//     });

//     // Add timing headers if available in debug data
//     if ((result as any).debug && (result as any).debug.timings) {
//       const timings = (result as any).debug.timings;
//       const browserTimings = (result as any).debug.browserTimings;

//       response.headers.set(
//         'X-DO-Allocation-Time',
//         timings.doAllocation.toString(),
//       );
//       response.headers.set(
//         'X-Browser-Setup-Time',
//         timings.browserSetup.toString(),
//       );
//       response.headers.set(
//         'X-Search-Execution-Time',
//         timings.searchExecution.toString(),
//       );
//       response.headers.set('X-Cleanup-Time', timings.cleanup.toString());
//       response.headers.set(
//         'X-Total-Time',
//         (Date.now() - timings.start).toString(),
//       );

//       // Add detailed browser setup timing headers
//       if (browserTimings) {
//         response.headers.set(
//           'X-Browser-Connect-Time',
//           browserTimings.connect.toString(),
//         );
//         response.headers.set(
//           'X-Browser-Version-Time',
//           browserTimings.version.toString(),
//         );
//         response.headers.set(
//           'X-Browser-NewPage-Time',
//           browserTimings.newPage.toString(),
//         );
//       }

//       // Add optimization tracking headers
//       response.headers.set('X-Manager-DO-Optimized', 'true');
//       response.headers.set(
//         'X-Session-ID-Cached',
//         timings.doAllocation < 100 ? 'true' : 'false',
//       );
//       response.headers.set(
//         'X-DO-Allocation-Efficiency',
//         timings.doAllocation < 50
//           ? 'excellent'
//           : timings.doAllocation < 200
//           ? 'good'
//           : timings.doAllocation < 500
//           ? 'fair'
//           : 'needs-improvement',
//       );

//       // Add connection retry tracking headers
//       if ((result as any).debug.connectionAttempts) {
//         response.headers.set(
//           'X-Connection-Attempts',
//           (result as any).debug.connectionAttempts.toString(),
//         );
//         response.headers.set(
//           'X-Connection-Retries',
//           (result as any).debug.connectionRetries.toString(),
//         );
//         response.headers.set(
//           'X-Connection-Success-Rate',
//           `${Math.round(
//             (1 / (result as any).debug.connectionAttempts) * 100,
//           )}%`,
//         );
//       }
//     }

//     return response;
//   } catch (error) {
//     console.error('Browser search error:', error);
//     return c.json(
//       {
//         error: 'Browser search failed',
//         details: error instanceof Error ? error.message : String(error),
//       },
//       500,
//     );
//   }
// });

// app.get('/browser/screenshot', async (c) => {
//   const url = c.req.query('url');
//   if (!url) return c.text('Missing ?url= parameter', 400);

//   try {
//     const options = {
//       url,
//       width: c.req.query('width')
//         ? Number.parseInt(c.req.query('width')!)
//         : undefined,
//       height: c.req.query('height')
//         ? Number.parseInt(c.req.query('height')!)
//         : undefined,
//       fullPage: c.req.query('fullPage') === 'true',
//       format: (c.req.query('format') as 'png' | 'jpeg') || 'png',
//       quality: c.req.query('quality')
//         ? Number.parseInt(c.req.query('quality')!)
//         : undefined,
//       waitFor: c.req.query('waitFor')
//         ? Number.parseInt(c.req.query('waitFor')!)
//         : undefined,
//       selector: c.req.query('selector') || undefined,
//     };

//     const result = await executeOperation(
//       c.env,
//       c.executionCtx as ExecutionContext,
//       async (page) => {
//         // Worker handles the operation locally
//         return await screenshotHandler.handleScreenshotRequest(page, options);
//       },
//     );

//     // Worker handles response formatting
//     return new Response(result.data, {
//       headers: {
//         'Content-Type': `image/${result.format}`,
//         'Content-Length': result.size.toString(),
//         'X-Screenshot-URL': result.url,
//       },
//     });
//   } catch (error) {
//     console.error('Browser screenshot error:', error);
//     return c.json(
//       {
//         error: 'Browser screenshot failed',
//         details: error instanceof Error ? error.message : String(error),
//       },
//       500,
//     );
//   }
// });

// app.get('/browser/markdown', async (c) => {
//   const url = c.req.query('url');
//   if (!url) return c.text('Missing ?url= parameter', 400);

//   try {
//     const options = {
//       url,
//       selector: c.req.query('selector') || undefined,
//       includeImages: c.req.query('includeImages') === 'true',
//       includeLinks: c.req.query('includeLinks') !== 'false',
//       waitFor: c.req.query('waitFor')
//         ? Number.parseInt(c.req.query('waitFor')!)
//         : undefined,
//     };

//     const result = await executeOperation(
//       c.env,
//       c.executionCtx as ExecutionContext,
//       async (page) => {
//         // Worker handles the operation locally
//         return await markdownHandler.handleMarkdownRequest(page, options);
//       },
//     );

//     return c.json({
//       operation: 'markdown',
//       ...result,
//     });
//   } catch (error) {
//     console.error('Browser markdown error:', error);
//     return c.json(
//       {
//         error: 'Browser markdown failed',
//         details: error instanceof Error ? error.message : String(error),
//       },
//       500,
//     );
//   }
// });

// app.post('/browser/html', async (c) => {
//   try {
//     const body = await c.req.json();

//     if (!body.url) {
//       return c.json({ error: 'Missing required parameter: url' }, 400);
//     }

//     const result = await executeOperation(
//       c.env,
//       c.executionCtx as ExecutionContext,
//       async (page) => {
//         // Worker handles the operation locally
//         return await htmlHandler.handleHtmlRequest(page, body);
//       },
//     );

//     return c.json(result);
//   } catch (error) {
//     console.error('Browser HTML error:', error);
//     return c.json(
//       {
//         error: 'Browser HTML extraction failed',
//         details: error instanceof Error ? error.message : String(error),
//       },
//       500,
//     );
//   }
// });

// Legacy redirect endpoints for backward compatibility
// app.get('/screenshot', async (c) => {
//   const url = c.req.query('url');
//   if (!url) return c.text('Missing ?url=', 400);

//   const requestUrl = new URL(c.req.url);
//   requestUrl.pathname = '/browser/screenshot';

//   return c.redirect(requestUrl.toString(), 301);
// });

// app.get('/markdown', async (c) => {
//   const url = c.req.query('url');
//   if (!url) return c.text('Missing ?url=', 400);

//   const requestUrl = new URL(c.req.url);
//   requestUrl.pathname = '/browser/markdown';

//   return c.redirect(requestUrl.toString(), 301);
// });

// app.post('/html', async (c) => {
//   const requestUrl = new URL(c.req.url);
//   requestUrl.pathname = '/browser/html';

//   return c.redirect(requestUrl.toString(), 307);
// });

// Browser manager endpoints
app.get('/browser/status', async (c) => {
  const managerId = c.env.BROWSER_MANAGER_DO.idFromName('global');
  const managerStub = c.env.BROWSER_MANAGER_DO.get(managerId);

  const doStatus = await managerStub.getStats();

  return c.json({
    ...doStatus,
    loadInfo: {
      isQueueing: doStatus.queuedRequests > 0,
      utilizationPercent: Math.round(
        (doStatus.busyDOs / doStatus.totalDOs) * 100,
      ),
      availableDOs: doStatus.idleDOs,
      busyDOs: doStatus.busyDOs,
      errorDOs: doStatus.errorDOs,
      queuedRequests: doStatus.queuedRequests,
      healthStatus:
        doStatus.errorDOs > 0
          ? 'degraded'
          : doStatus.idleDOs === 0
          ? 'overloaded'
          : 'healthy',
    },
  });
});

// Proactive browser creation endpoint
app.post('/browser/create', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const count = body.count || 1; // Default create 1 browser

    const managerId = c.env.BROWSER_MANAGER_DO.idFromName('global');
    const managerStub = c.env.BROWSER_MANAGER_DO.get(managerId);

    const result = await managerStub.createBrowsersBatch(count);

    return c.json({
      action: 'create-browsers',
      ...result,
      message: `Batch creation completed - requested: ${result.requested}, created: ${result.created}, skipped: ${result.skipped}`,
    });
  } catch (error) {
    console.error('Browser creation error:', error);
    return c.json(
      {
        error: 'Browser creation failed',
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// Delete all DOs completely (destructive operation)
app.post('/browser/delete-all', async (c) => {
  const managerId = c.env.BROWSER_MANAGER_DO.idFromName('global');
  const managerStub = c.env.BROWSER_MANAGER_DO.get(managerId);

  const result = await managerStub.fetch(
    new Request(`${new URL(c.req.url).origin}/delete-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }),
  );
  return result;
});

app.get('/browser/check-remaining', async (c) => {
  const limits = await puppeteer.limits(c.env.BROWSER);
  const {
    activeSessions,
    maxConcurrentSessions,
    allowedBrowserAcquisitions,
    timeUntilNextAllowedBrowserAcquisition,
  } = limits;
  return c.json({
    activeSessions,
    maxConcurrentSessions,
    allowedBrowserAcquisitions,
    timeUntilNextAllowedBrowserAcquisition,
  });
});

export default app;
export { BrowserDO, BrowserManagerDO };
