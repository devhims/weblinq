import type { Context } from 'hono';

import * as HttpStatusCodes from 'stoker/http-status-codes';

import type { AppBindings } from '@/lib/types';

import { createStandardErrorResponse, createStandardSuccessResponse, ERROR_CODES } from '@/lib/response-utils';

/**
 * Browser status endpoint - Get detailed status of all browser DOs for system monitoring
 */
export async function browserStatus(c: Context<AppBindings>) {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists

    console.log('🔍 Browser status request:', { userId: user.id });

    // Get the browser manager directly
    const managerId = c.env.BROWSER_MANAGER_DO.idFromName('global');
    const managerStub = c.env.BROWSER_MANAGER_DO.get(managerId);

    // Get detailed browser status
    const result = await managerStub.getBrowserStatus();

    console.log('📊 Browser status result:', {
      totalDOs: result.totalDOs,
      maxCapacity: result.maxCapacity,
      queuedRequests: result.queuedRequests,
      browserDOsCount: result.browserDOs.length,
    });

    return c.json(
      createStandardSuccessResponse(result, 0), // No credits cost for system monitoring
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error('Browser status error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
}

/**
 * Session health test endpoint - Test if a specific browser session ID is healthy
 */
export async function sessionHealth(c: Context<AppBindings>) {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists
    const body = await c.req.json();

    if (!body.sessionId || typeof body.sessionId !== 'string') {
      const errorResponse = createStandardErrorResponse('Session ID is required', ERROR_CODES.VALIDATION_ERROR);
      return c.json(errorResponse, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    console.log('🩺 Session health test request:', { userId: user.id, sessionId: body.sessionId });

    const startTime = Date.now();

    try {
      // Import connect function to test the session
      const { connect } = await import('@cloudflare/puppeteer');

      // Try to connect to the session
      const browser = await connect(c.env.BROWSER, body.sessionId);

      // Get browser info to confirm it's working
      const version = await browser.version();

      // Disconnect cleanly
      await (browser as any).disconnect();

      const responseTime = Date.now() - startTime;

      console.log('✅ Session health test successful:', {
        sessionId: body.sessionId,
        responseTime,
        browserInfo: version,
      });

      return c.json(
        createStandardSuccessResponse(
          {
            sessionId: body.sessionId,
            healthy: true,
            responseTime,
            browserInfo: version,
            testTimestamp: new Date().toISOString(),
          },
          0,
        ), // No credits cost for system monitoring
        HttpStatusCodes.OK,
      );
    } catch (sessionError) {
      const responseTime = Date.now() - startTime;
      const errorMessage = sessionError instanceof Error ? sessionError.message : String(sessionError);

      console.log('❌ Session health test failed:', {
        sessionId: body.sessionId,
        responseTime,
        error: errorMessage,
      });

      return c.json(
        createStandardSuccessResponse(
          {
            sessionId: body.sessionId,
            healthy: false,
            responseTime,
            error: errorMessage,
            testTimestamp: new Date().toISOString(),
          },
          0,
        ), // Request succeeded, but session is unhealthy
        HttpStatusCodes.OK,
      );
    }
  } catch (error) {
    console.error('Session health test error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
}

/**
 * Create browser batch endpoint - Proactively create multiple browser DOs with staggered timing
 */
export async function createBrowsers(c: Context<AppBindings>) {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists
    const body = await c.req.json();

    const count = body.count || 1;
    if (typeof count !== 'number' || count < 1 || count > 4) {
      const errorResponse = createStandardErrorResponse(
        'Count must be a number between 1 and 4',
        ERROR_CODES.VALIDATION_ERROR,
      );
      return c.json(errorResponse, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    console.log('🚀 Create browsers request:', { userId: user.id, count });

    // Get the browser manager
    const managerId = c.env.BROWSER_MANAGER_DO.idFromName('global');
    const managerStub = c.env.BROWSER_MANAGER_DO.get(managerId);

    // Create browsers batch
    const result = await managerStub.createBrowsersBatch(count);

    console.log('✅ Browsers batch result:', {
      requested: result.requested,
      created: result.created,
      skipped: result.skipped,
    });

    return c.json(createStandardSuccessResponse(result, 0), HttpStatusCodes.OK);
  } catch (error) {
    console.error('Create browsers error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Unknown create browsers error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
}

/**
 * Cleanup DO endpoint - Remove a specific browser DO that may be stuck or problematic
 */
export async function cleanupDo(c: Context<AppBindings>) {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists
    const body = await c.req.json();

    if (!body.doId || typeof body.doId !== 'string') {
      const errorResponse = createStandardErrorResponse('Browser DO ID is required', ERROR_CODES.VALIDATION_ERROR);
      return c.json(errorResponse, HttpStatusCodes.UNPROCESSABLE_ENTITY);
    }

    console.log('🧹 Cleanup DO request:', { userId: user.id, doId: body.doId });

    // Get the browser manager
    const managerId = c.env.BROWSER_MANAGER_DO.idFromName('global');
    const managerStub = c.env.BROWSER_MANAGER_DO.get(managerId);

    // Call the removeBrowserDO method directly
    await managerStub.removeBrowserDO(body.doId);

    const result = {
      action: 'cleanup-do' as const,
      doId: body.doId,
      message: `Successfully cleaned up and removed BrowserDO: ${body.doId}`,
    };

    console.log('✅ DO cleanup result:', result);

    return c.json(createStandardSuccessResponse(result, 0), HttpStatusCodes.OK);
  } catch (error) {
    console.error('Cleanup DO error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Unknown cleanup error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
}

/**
 * Delete all browsers endpoint - Remove ALL browser DOs (useful for deployment cleanup)
 */
export async function deleteAllBrowsers(c: Context<AppBindings>) {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists

    console.log('🗑️ Delete all browsers request:', { userId: user.id });

    // Get the browser manager
    const managerId = c.env.BROWSER_MANAGER_DO.idFromName('global');
    const managerStub = c.env.BROWSER_MANAGER_DO.get(managerId);

    // Call the deleteAllBrowserDOs method directly
    const result = await managerStub.deleteAllBrowserDOs();

    console.log('✅ Delete all browsers result:', {
      successCount: result.successCount,
      failureCount: result.failureCount,
      totalFound: result.totalFound,
    });

    return c.json(createStandardSuccessResponse(result, 0), HttpStatusCodes.OK);
  } catch (error) {
    console.error('Delete all browsers error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Unknown delete all browsers error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
}

/**
 * Check remaining endpoint - Check Cloudflare Browser API limits and quotas
 */
export async function checkRemaining(c: Context<AppBindings>) {
  try {
    const user = c.get('user')!; // requireAuth ensures user exists

    console.log('📊 Check remaining API limits request:', { userId: user.id });

    // Import puppeteer dynamically to access limits
    const puppeteer = await import('@cloudflare/puppeteer');

    // Get browser API limits from Cloudflare
    const limits = await puppeteer.limits(c.env.BROWSER);
    const {
      activeSessions,
      maxConcurrentSessions,
      allowedBrowserAcquisitions,
      timeUntilNextAllowedBrowserAcquisition,
    } = limits;

    console.log('✅ Browser API limits retrieved:', {
      activeSessions,
      maxConcurrentSessions,
      allowedBrowserAcquisitions,
      timeUntilNext: timeUntilNextAllowedBrowserAcquisition,
    });

    return c.json(
      createStandardSuccessResponse(
        {
          activeSessions,
          maxConcurrentSessions,
          allowedBrowserAcquisitions,
          timeUntilNextAllowedBrowserAcquisition,
        },
        0,
      ), // No credits cost for system monitoring
      HttpStatusCodes.OK,
    );
  } catch (error) {
    console.error('Check remaining API limits error:', error);
    const errorResponse = createStandardErrorResponse(
      error instanceof Error ? error.message : 'Unknown check remaining error',
      ERROR_CODES.INTERNAL_SERVER_ERROR,
    );
    return c.json(errorResponse, HttpStatusCodes.INTERNAL_SERVER_ERROR, {
      'X-Request-ID': errorResponse.error.requestId!,
    });
  }
}
