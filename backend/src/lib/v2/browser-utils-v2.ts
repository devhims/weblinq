/// <reference lib="dom" />

import type { Page } from '@cloudflare/playwright';

// Note: Removed unused browser session management functions
// All browser operations now go through PlaywrightPoolDO for consistency

// Utility: simple promise-based delay used to mimic human timing behaviour
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lightweight page preparation for screenshots - NO resource blocking for speed
 * Based on playwright-mcp-main approach for fast visual captures
 */
export async function hardenPageForScreenshots(page: Page) {
  // Minimal user agent without extensive fingerprinting
  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  await page.setExtraHTTPHeaders({
    'User-Agent': UA,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  });

  // NO resource blocking for screenshots - we want all images, CSS, fonts to load for visual accuracy
  // This is the key difference from content extraction
  console.log('📸 Screenshot mode: Allowing all resources for visual accuracy');
}

/**
 * Fast navigation optimized for screenshots following playwright-mcp-main approach
 */
export async function navigateForScreenshot(page: Page, url: string, waitTime?: number): Promise<void> {
  console.log(`🚀 Fast navigation for screenshot to ${url}`);

  const startTime = Date.now();

  await page.goto(url, { waitUntil: 'commit' });

  await Promise.any([
    page.waitForLoadState('load', { timeout: 5000 }),
    page.waitForFunction(() => document.readyState === 'interactive', { timeout: 3000 }),
  ]);

  // Optional additional wait
  if (waitTime && waitTime > 0) {
    console.log(`⏳ Additional wait: ${waitTime}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  console.log('✅ Fast navigation completed');

  const endTime = Date.now();
  const duration = endTime - startTime;
  console.log(`🚀 Fast navigation completed in ${duration}ms`);
}

/**
 * Advanced hardening function to evade modern bot detection systems for Playwright.
 * Addresses multiple fingerprinting vectors that basic methods miss.
 */
export async function hardenPageAdvanced(page: Page) {
  // Realistic user agent with proper Chrome version matching
  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  await page.setExtraHTTPHeaders({
    'User-Agent': UA,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'max-age=0',
    'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
  });

  // Set realistic viewport with some randomization
  const viewports = [
    { width: 1920, height: 1080 },
    { width: 1366, height: 768 },
    { width: 1536, height: 864 },
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1600, height: 900 },
  ];
  const viewport = viewports[Math.floor(Math.random() * viewports.length)];
  await page.setViewportSize(viewport);

  // Comprehensive fingerprint evasion - run before any page loads
  await page.addInitScript(() => {
    // Remove webdriver traces
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // Fix the navigator.languages issue
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Mock realistic plugins array
    Object.defineProperty(navigator, 'plugins', {
      get: () => ({
        0: {
          name: 'Chrome PDF Plugin',
          filename: 'internal-pdf-viewer',
          description: 'Portable Document Format',
          length: 1,
        },
        1: {
          name: 'Chrome PDF Viewer',
          filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          description: '',
          length: 1,
        },
        2: {
          name: 'Native Client',
          filename: 'internal-nacl-plugin',
          description: '',
          length: 2,
        },
        length: 3,
        item(index: number) {
          return this[index] || null;
        },
        namedItem(name: string) {
          for (let i = 0; i < this.length; i++) {
            if (this[i].name === name) return this[i];
          }
          return null;
        },
        refresh() {},
      }),
    });

    // Mock chrome object (missing in headless)
    const w = window as any;
    if (!w.chrome) {
      w.chrome = {
        runtime: {
          onConnect: undefined,
          onMessage: undefined,
        },
        loadTimes() {
          return {
            requestTime: performance.now() / 1000 - Math.random(),
            startLoadTime: performance.now() / 1000 - Math.random(),
            commitLoadTime: performance.now() / 1000 - Math.random(),
            finishDocumentLoadTime: performance.now() / 1000 - Math.random(),
            finishLoadTime: performance.now() / 1000 - Math.random(),
            firstPaintTime: performance.now() / 1000 - Math.random(),
            firstPaintAfterLoadTime: 0,
            navigationType: 'Other',
            wasFetchedViaSpdy: false,
            wasNpnNegotiated: false,
            npnNegotiatedProtocol: 'unknown',
            wasAlternateProtocolAvailable: false,
            connectionInfo: 'unknown',
          };
        },
        csi() {
          return {
            startE: Math.round(performance.now()),
            onloadT: Math.round(performance.now()),
            pageT: Math.round(performance.now()),
            tran: 15,
          };
        },
      };
    }

    // Fix permissions API
    const originalQuery = window.navigator.permissions.query;
    // Cast to any to avoid strict type mismatch with PermissionStatus
    window.navigator.permissions.query = ((parameters: PermissionDescriptor) => {
      if (parameters.name === 'notifications') {
        // Return a minimal PermissionStatus-like object for notifications
        return Promise.resolve({ state: Notification.permission } as any);
      }
      return originalQuery(parameters) as any;
    }) as any;

    // Override getUserMedia to avoid detection
    const getMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (typeof getMedia === 'function') {
      navigator.mediaDevices.getUserMedia = function (_constraints: MediaStreamConstraints) {
        return new Promise((resolve, reject) => {
          // Simulate realistic delay
          setTimeout(() => {
            reject(new DOMException('Permission denied', 'NotAllowedError'));
          }, Math.random() * 100 + 50);
        });
      };
    }

    // Mock WebGL to avoid headless detection
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
      // Return realistic values instead of headless indicators
      try {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, parameter);
      } catch (e) {
        console.error('WebGL parameter error:', e);
        return getParameter.call(this, parameter);
      }
    };

    // Override screen properties to match viewport
    Object.defineProperty(screen, 'availHeight', {
      get: () => window.innerHeight,
    });
    Object.defineProperty(screen, 'availWidth', {
      get: () => window.innerWidth,
    });

    // Add realistic timing jitter
    const originalRandom = Math.random;
    Math.random = function () {
      return originalRandom.call(this) * 0.99 + 0.005;
    };

    // Mock battery API
    if ('getBattery' in navigator) {
      const _originalGetBattery = navigator.getBattery;
      navigator.getBattery = function () {
        return Promise.resolve({
          charging: true,
          chargingTime: Infinity,
          dischargingTime: Infinity,
          level: 0.8 + Math.random() * 0.2,
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return true;
          },
        });
      };
    }

    // Hide automation indicators from iframe detection
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      get() {
        const win = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'contentWindow')!.get!.call(this);
        if (win) {
          Object.defineProperty(win, 'navigator', {
            value: navigator,
            writable: false,
          });
        }
        return win;
      },
    });

    // Fix date-time consistency
    const originalDate = Date;

    // Override global Date constructor inside page context for fingerprint jitter
    (globalThis as any).Date = class extends originalDate {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super();
          // Add slight jitter to timestamps
          const jitter = Math.floor(Math.random() * 1000);
          this.setTime(this.getTime() + jitter);
        } else {
          super(...(args as []));
        }
      }

      static now() {
        return originalDate.now() + Math.floor(Math.random() * 1000);
      }
    };

    // Override performance.now for timing consistency
    const originalPerformanceNow = performance.now;
    const performanceOffset = Math.random() * 1000;
    performance.now = function () {
      return originalPerformanceNow.call(this) + performanceOffset;
    };
  });

  // Block heavy resources for faster loading
  await page.route('**/*', (route) => {
    try {
      // Add null check for route and request
      if (!route || !route.request) {
        console.warn('Route or request is null, skipping');
        return;
      }

      const request = route.request();
      if (!request) {
        console.warn('Request is null, continuing with route');
        route.continue();
        return;
      }

      const resourceType = request.resourceType();
      const shouldAbort = ['image', 'media', 'font', 'stylesheet'].includes(resourceType);

      if (shouldAbort) {
        route.abort();
      } else {
        route.continue();
      }
    } catch (error) {
      console.warn('Error in route handler:', error);
      // Try to continue the route if possible
      try {
        route.continue();
      } catch (continueError) {
        console.warn('Failed to continue route:', continueError);
      }
    }
  });
}

/**
 * Add human-like behavior patterns after page load
 */
export async function addHumanBehavior(page: Page) {
  // Reduce random delays
  await sleep(Math.random() * 800 + 200); // 0.2-1 second instead of 1-3

  // Simulate mouse movement (keep this - it's fast and effective)
  const viewport = page.viewportSize();
  if (viewport) {
    const randomX = Math.random() * viewport.width;
    const randomY = Math.random() * viewport.height;
    await page.mouse.move(randomX, randomY);
  }

  // Skip the scroll or make it faster
  await page.evaluate(() => window.scrollBy(0, 50)); // Quick scroll

  // Shorter final delay
  await sleep(100); // Fixed 100ms
}

/**
 * Helper to retry page.goto() for transient network failures
 * Common failures: ERR_CONNECTION_CLOSED, ERR_NETWORK_CHANGED, timeouts
 */
export async function pageGotoWithRetry(
  page: Page,
  url: string,
  options: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeout?: number;
  } = {},
  maxAttempts = 3,
): Promise<void> {
  const { waitUntil = 'domcontentloaded', timeout = 30_000 } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await page.goto(url, { waitUntil, timeout });
      console.log(`✅ Page navigation successful on attempt ${attempt}/${maxAttempts} for ${url}`);
      return;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn(`❌ Page navigation attempt ${attempt}/${maxAttempts} failed for ${url}: ${errorMessage}`);

      // Check if this is a network-related error that's worth retrying
      const isRetryableError =
        errorMessage.includes('ERR_CONNECTION_CLOSED') ||
        errorMessage.includes('ERR_NETWORK_CHANGED') ||
        errorMessage.includes('ERR_CONNECTION_RESET') ||
        errorMessage.includes('ERR_TIMED_OUT') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('net::ERR');

      if (!isRetryableError || attempt === maxAttempts) {
        console.error(`🚫 Page navigation failed after ${attempt} attempts for ${url}: ${errorMessage}`);
        throw err;
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoff = 1000 * 2 ** (attempt - 1);
      console.log(`⏳ Retrying page navigation in ${backoff}ms...`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}
