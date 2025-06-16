import type { BrowserManagerDO } from '@/browser/browser-manager-do';
import type { Browser, Page } from '@cloudflare/puppeteer';
import type { ExecutionContext } from '@cloudflare/workers-types';

import { connect } from '@cloudflare/puppeteer';

/**
 * Harden a puppeteer page against basic fingerprinting.
 */
export async function hardenPage(page: Page) {
  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

  await page.setUserAgent(UA);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4] });
  });
  await page.setViewport({ width: 1920, height: 1080 });
}

/**
 * Acquire a browser session through BrowserManagerDO, execute `operation`,
 * and ensure proper clean‑up & DO status updates with concise logging.
 */
export async function runWithBrowser<T>(
  env: CloudflareBindings,
  operation: (page: Page) => Promise<T>,
  timeout = 30_000, // 15 seconds
  ctx?: ExecutionContext, // optional – non‑blocking status updates when provided
): Promise<T> {
  /* -------------------------------------------------------------------------
   * Helper – update DO status with retry logic (max 3 attempts) + logging
   * ----------------------------------------------------------------------- */
  async function updateDOStatusWithRetry(
    managerStub: DurableObjectStub<BrowserManagerDO>,
    browserDoId: string,
    status: 'idle' | 'busy' | 'error',
    maxAttempts = 3,
    errorMessage?: string,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await managerStub.updateDOStatus(browserDoId, status, errorMessage);
        console.log(`BrowserDO ${browserDoId} marked ${status}${errorMessage ? ` (reason: ${errorMessage})` : ''}`);
        return;
      } catch (err) {
        if (attempt === maxAttempts) throw err;
        const backoff = 200 * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  /* -------------------------------------------------------------------------
   * Helper – quick probe to verify session is alive
   * ----------------------------------------------------------------------- */
  async function testBrowserConnection(env: CloudflareBindings, sessionId: string) {
    const browser = await connect(env.BROWSER, sessionId);
    await browser.version(); // inexpensive – fails fast if session stale
    return browser;
  }

  /* -------------------------------------------------------------------------
   * Helper – obtain a healthy browser instance with retry logic & logging
   * ----------------------------------------------------------------------- */
  async function connectSessionWithRetry(
    env: CloudflareBindings,
    managerStub: DurableObjectStub<BrowserManagerDO>,
    maxAttempts = 5,
  ): Promise<{ browser: Browser; browserDoId: string; sessionId: string }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const { id: browserDoId, sessionId } = await managerStub.getAvailableBrowserDO();

      try {
        const browser = await testBrowserConnection(env, sessionId);
        console.log(
          `✅ Connected to BrowserDO ${browserDoId} (session ${sessionId}) on attempt ${attempt}/${maxAttempts}`,
        );
        return { browser, browserDoId, sessionId };
      } catch (err) {
        console.warn(
          `❌ Connection test failed for BrowserDO ${browserDoId} on attempt ${attempt}/${maxAttempts}: ${
            err instanceof Error ? err.message : err
          }`,
        );

        await updateDOStatusWithRetry(managerStub, browserDoId, 'error', 3, 'Connection test failed');

        if (attempt === maxAttempts) {
          console.error(`🚫 Exhausted all ${maxAttempts} attempts to acquire a healthy browser session`);
          throw err;
        }

        const backoff = 200 * 2 ** (attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }

    // Should never reach here
    throw new Error('Unexpected exhaustion in connectSessionWithRetry');
  }

  /* -------------------------------------------------------------------------
   * Main flow
   * ----------------------------------------------------------------------- */
  const managerId = env.BROWSER_MANAGER_DO.idFromName('global');
  const managerStub = env.BROWSER_MANAGER_DO.get(managerId);

  let browser: Browser | null = null;
  let page: Page | null = null;
  let browserDoId: string | null = null;

  try {
    // 1. Acquire browser
    const { browser: acquiredBrowser, browserDoId: doId } = await connectSessionWithRetry(env, managerStub);
    browser = acquiredBrowser;
    browserDoId = doId;

    // 2. Prepare page
    page = await browser.newPage();
    await hardenPage(page);

    // 3. Execute payload with timeout race
    const result = await Promise.race([
      operation(page),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeout)),
    ]);

    // 4. Mark DO idle (non‑blocking when ctx provided)
    const idlePromise = updateDOStatusWithRetry(managerStub, browserDoId, 'idle');
    if (ctx) ctx.waitUntil(idlePromise);
    else await idlePromise;

    return result as T;
  } catch (err) {
    if (browserDoId) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const errorPromise = updateDOStatusWithRetry(managerStub, browserDoId, 'error', 3, errMsg);
      if (ctx) ctx.waitUntil(errorPromise);
      else await errorPromise;
    }

    throw err;
  } finally {
    if (page && !page.isClosed()) {
      try {
        await page.close();
      } catch {}
    }
    if (browser) {
      try {
        browser.disconnect(); // keep session alive for reuse
      } catch {}
    }
  }
}
