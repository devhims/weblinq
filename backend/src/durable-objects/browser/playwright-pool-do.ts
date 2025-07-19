import { DurableObject } from 'cloudflare:workers';

import type { ContentParams, ContentResult } from '@/lib/v2/content-v2';
import type { LinksParams, LinksResult } from '@/lib/v2/links-v2';
import type { MarkdownParams, MarkdownResult } from '@/lib/v2/markdown-v2';
import type { PdfParams, PdfResult } from '@/lib/v2/pdf-v2';
import type { ScrapeParams, ScrapeResult } from '@/lib/v2/scrape-v2';
import type { ScreenshotParams, ScreenshotResult } from '@/lib/v2/screenshot-v2';
import type { SearchParams, SearchResult } from '@/lib/v2/search-v2';
import type { Browser, Page } from '@cloudflare/playwright';

// Import browser utilities and operation handlers
import { hardenPageAdvanced, pageGotoWithRetry } from '@/lib/v2/browser-utils-v2';
import { contentOperation } from '@/lib/v2/content-v2';
import { linksOperation } from '@/lib/v2/links-v2';
import { markdownOperation } from '@/lib/v2/markdown-v2';
import { pdfOperation } from '@/lib/v2/pdf-v2';
import { scrapeOperation } from '@/lib/v2/scrape-v2';
import { screenshotOperation } from '@/lib/v2/screenshot-v2';
import { searchOperation } from '@/lib/v2/search-v2';
import { connect, launch, limits, sessions } from '@cloudflare/playwright';

/* -------------------------------------------------------------------------- */
/*  Types & Constants                                                         */
/* -------------------------------------------------------------------------- */

const KEEP_ALIVE_MS = 10 * 60 * 1000; // remote browser lifetime (launch param)

/* -------------------------------------------------------------------------- */
/*  PlaywrightPoolDO                                                          */
/* -------------------------------------------------------------------------- */

export class PlaywrightPoolDO extends DurableObject<CloudflareBindings> {
  constructor(state: DurableObjectState, env: CloudflareBindings) {
    super(state, env);

    console.log('🔧 PlaywrightPoolDO: Initialized with session reuse and modular markdown processing');
  }

  /* ----------------------------- Public RPCs ----------------------------- */

  /** Helper method to check if we can launch a new browser session */
  private async canLaunchNewSession(): Promise<{
    canLaunch: boolean;
    reason?: string;
  }> {
    try {
      console.log('📊 PlaywrightPoolDO: Checking limits before launching new session...');
      const currentLimits = await limits(this.env.BROWSER);

      console.log(`📈 PlaywrightPoolDO: Current limits:`, {
        maxConcurrentSessions: currentLimits.maxConcurrentSessions,
        activeSessions: currentLimits.activeSessions.length,
        allowedBrowserAcquisitions: currentLimits.allowedBrowserAcquisitions,
        timeUntilNext: currentLimits.timeUntilNextAllowedBrowserAcquisition,
      });

      // Check if we're at the concurrent session limit
      if (currentLimits.activeSessions.length >= currentLimits.maxConcurrentSessions) {
        return {
          canLaunch: false,
          reason: `At max concurrent sessions limit (${currentLimits.maxConcurrentSessions})`,
        };
      }

      // Check if we're allowed to acquire new browsers
      if (currentLimits.allowedBrowserAcquisitions <= 0) {
        return {
          canLaunch: false,
          reason: `No browser acquisitions allowed. Wait ${currentLimits.timeUntilNextAllowedBrowserAcquisition}ms`,
        };
      }

      console.log('✅ PlaywrightPoolDO: Can launch new session within limits');
      return { canLaunch: true };
    } catch (error) {
      console.warn('⚠️ PlaywrightPoolDO: Error checking limits:', error);
      // If we can't check limits, allow the launch attempt (fail gracefully)
      return { canLaunch: true };
    }
  }

  /** Helper method to get an available session for reuse */
  private async getAvailableSession(): Promise<string | null> {
    try {
      console.log('🔍 PlaywrightPoolDO: Checking for available sessions...');
      const activeSessions = await sessions(this.env.BROWSER);
      console.log(`📊 PlaywrightPoolDO: Found ${activeSessions.length} total sessions`);

      // Filter sessions without active connections (available for reuse)
      const availableSessions = activeSessions.filter((session) => !session.connectionId);
      console.log(`🆓 PlaywrightPoolDO: Found ${availableSessions.length} available sessions`);

      if (availableSessions.length > 0) {
        // Pick a random available session
        const randomSession = availableSessions[Math.floor(Math.random() * availableSessions.length)];
        console.log(`🎯 PlaywrightPoolDO: Selected session ${randomSession.sessionId} for reuse`);
        return randomSession.sessionId;
      }

      console.log('💭 PlaywrightPoolDO: No available sessions found');
      return null;
    } catch (error) {
      console.warn('⚠️ PlaywrightPoolDO: Error checking sessions:', error);
      return null;
    }
  }

  /** Main RPC method to extract markdown from a URL using proper session reuse. */
  async extractMarkdown(params: MarkdownParams): Promise<MarkdownResult> {
    console.log(`📄 PlaywrightPoolDO: Markdown extraction request for ${params.url}`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let sessionReused = false;

    try {
      // Try to reuse an existing session first
      const availableSessionId = await this.getAvailableSession();

      if (availableSessionId) {
        try {
          console.log(`🔗 PlaywrightPoolDO: Attempting to connect to session ${availableSessionId}...`);
          browser = await connect(this.env.BROWSER, availableSessionId);
          sessionReused = true;
          console.log(`✅ PlaywrightPoolDO: Successfully connected to existing session ${availableSessionId}`);
        } catch (connectError) {
          console.warn(`⚠️ PlaywrightPoolDO: Failed to connect to session ${availableSessionId}:`, connectError);
          // Continue to launch new session
        }
      }

      // If no session was reused, launch a new one (with limits check)
      if (!browser) {
        const limitsCheck = await this.canLaunchNewSession();

        if (!limitsCheck.canLaunch) {
          console.error(`🚫 PlaywrightPoolDO: Cannot launch new session: ${limitsCheck.reason}`);
          throw new Error(`Browser session limit reached: ${limitsCheck.reason}`);
        }

        console.log('🚀 PlaywrightPoolDO: Launching new browser session within limits...');
        browser = await launch(this.env.BROWSER, {
          keep_alive: KEEP_ALIVE_MS, // 10 minutes
        });
        console.log(`✅ PlaywrightPoolDO: New browser session launched with ID ${browser.sessionId()}`);
      }

      const sessionId = browser.sessionId();
      console.log(`🎯 PlaywrightPoolDO: Using session ${sessionId} (${sessionReused ? 'reused' : 'new'})`);

      // Create and prepare page
      console.log(`🌐 PlaywrightPoolDO: Creating new page...`);
      page = await browser.newPage();
      await hardenPageAdvanced(page);

      // Navigate to URL with retry logic
      console.log(`🔄 PlaywrightPoolDO: Navigating to ${params.url}...`);
      await pageGotoWithRetry(page, params.url, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });

      // Wait if requested
      if (params.waitTime && params.waitTime > 0) {
        console.log(`⏳ PlaywrightPoolDO: Waiting ${params.waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }

      // Execute markdown operation
      console.log(`🔄 PlaywrightPoolDO: Executing markdown operation...`);
      const result = await markdownOperation(page, params);

      if (result.success) {
        console.log(
          `✅ PlaywrightPoolDO: Markdown extraction successful. Word count: ${result.data.metadata.wordCount}`,
        );
      } else {
        console.error(`❌ PlaywrightPoolDO: Markdown processing failed: ${result.error.message}`);
      }

      return result;
    } catch (error) {
      console.error(`💥 PlaywrightPoolDO: Markdown extraction failed for ${params.url}:`, error);
      return {
        success: false as const,
        error: { message: String(error) },
        creditsCost: 0,
      };
    } finally {
      // Cleanup: close page and close browser connection
      if (page && !page.isClosed()) {
        try {
          console.log(`🧹 PlaywrightPoolDO: Closing page...`);
          // await page.unroute('**/*');
          await page.close();
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing page:', closeError);
        }
      }

      if (browser) {
        try {
          console.log(
            `🔌 PlaywrightPoolDO: Closing browser session ${browser.sessionId()} (${
              sessionReused ? 'was reused' : 'newly created'
            })`,
          );
          await browser.close();
          console.log(`✅ PlaywrightPoolDO: Browser session closed successfully`);
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing browser:', closeError);
        }
      }
    }
  }

  /** Helper method to extract structured data (title, meta description, JSON-LD) from a page */
  async extractStructuredData(params: { url: string; waitTime?: number }): Promise<{
    success: boolean;
    data?: {
      title: string;
      metaDescription: string;
      structuredData: any[];
      url: string;
    };
    error?: { message: string };
  }> {
    console.log(`🔍 PlaywrightPoolDO: Structured data extraction request for ${params.url}`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let sessionReused = false;

    try {
      // Try to reuse an existing session first
      const availableSessionId = await this.getAvailableSession();

      if (availableSessionId) {
        try {
          console.log(`🔗 PlaywrightPoolDO: Attempting to connect to session ${availableSessionId}...`);
          browser = await connect(this.env.BROWSER, availableSessionId);
          sessionReused = true;
          console.log(`✅ PlaywrightPoolDO: Successfully connected to existing session ${availableSessionId}`);
        } catch (connectError) {
          console.warn(`⚠️ PlaywrightPoolDO: Failed to connect to session ${availableSessionId}:`, connectError);
          // Continue to launch new session
        }
      }

      // If no session was reused, launch a new one
      if (!browser) {
        const limitsCheck = await this.canLaunchNewSession();

        if (!limitsCheck.canLaunch) {
          console.error(`🚫 PlaywrightPoolDO: Cannot launch new session: ${limitsCheck.reason}`);
          throw new Error(`Browser session limit reached: ${limitsCheck.reason}`);
        }

        console.log('🚀 PlaywrightPoolDO: Launching new browser session...');
        browser = await launch(this.env.BROWSER, { keep_alive: KEEP_ALIVE_MS });
        console.log(`✅ PlaywrightPoolDO: New session launched with ID: ${browser.sessionId()}`);
      }

      // Get a page and navigate
      page = await browser.newPage();
      await hardenPageAdvanced(page); // Apply security hardening

      console.log(`🌐 PlaywrightPoolDO: Navigating to ${params.url}...`);
      await pageGotoWithRetry(page, params.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      // Wait for optional delay
      if (params.waitTime && params.waitTime > 0) {
        console.log(`⏳ PlaywrightPoolDO: Waiting ${params.waitTime}ms...`);
        await page.waitForTimeout(params.waitTime);
      }

      // Extract structured data
      const structuredData = await page.evaluate(() => {
        const title = document.title || '';
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';

        // Extract JSON-LD structured data
        const jsonLdElements = document.querySelectorAll('script[type="application/ld+json"]');
        const structuredData: any[] = [];

        jsonLdElements.forEach((element) => {
          try {
            const data = JSON.parse(element.textContent || '');
            structuredData.push(data);
          } catch {
            // Ignore invalid JSON-LD
          }
        });

        return {
          title,
          metaDescription,
          structuredData,
          url: window.location.href,
        };
      });

      console.log(`✅ PlaywrightPoolDO: Structured data extraction completed for ${params.url}`, {
        hasTitle: !!structuredData.title,
        hasDescription: !!structuredData.metaDescription,
        structuredDataCount: structuredData.structuredData.length,
        sessionReused,
      });

      return {
        success: true,
        data: structuredData,
      };
    } catch (error) {
      console.error(`❌ PlaywrightPoolDO: Structured data extraction failed for ${params.url}:`, error);
      return {
        success: false,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    } finally {
      // Always close the page, but keep the browser session for reuse
      if (page) {
        try {
          await page.close();
          console.log('🧹 PlaywrightPoolDO: Page closed successfully');
        } catch (pageCloseError) {
          console.warn('⚠️ PlaywrightPoolDO: Failed to close page:', pageCloseError);
        }
      }

      // Don't close the browser - let it be reused for future requests
      console.log('♻️ PlaywrightPoolDO: Browser session kept alive for reuse');
    }
  }

  /** Main RPC method to take screenshot from a URL using proper session reuse. */
  async takeScreenshot(params: ScreenshotParams): Promise<ScreenshotResult> {
    console.log(`📸 PlaywrightPoolDO: Screenshot request for ${params.url}`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let sessionReused = false;

    try {
      // Try to reuse an existing session first
      const availableSessionId = await this.getAvailableSession();

      if (availableSessionId) {
        try {
          console.log(`🔗 PlaywrightPoolDO: Attempting to connect to session ${availableSessionId}...`);
          browser = await connect(this.env.BROWSER, availableSessionId);
          sessionReused = true;
          console.log(`✅ PlaywrightPoolDO: Successfully connected to existing session ${availableSessionId}`);
        } catch (connectError) {
          console.warn(`⚠️ PlaywrightPoolDO: Failed to connect to session ${availableSessionId}:`, connectError);
          // Continue to launch new session
        }
      }

      // If no session was reused, launch a new one (with limits check)
      if (!browser) {
        const limitsCheck = await this.canLaunchNewSession();

        if (!limitsCheck.canLaunch) {
          console.error(`🚫 PlaywrightPoolDO: Cannot launch new session: ${limitsCheck.reason}`);
          throw new Error(`Browser session limit reached: ${limitsCheck.reason}`);
        }

        console.log('🚀 PlaywrightPoolDO: Launching new browser session within limits...');
        browser = await launch(this.env.BROWSER, {
          keep_alive: KEEP_ALIVE_MS, // 10 minutes
        });
        console.log(`✅ PlaywrightPoolDO: New browser session launched with ID ${browser.sessionId()}`);
      }

      const sessionId = browser.sessionId();
      console.log(`🎯 PlaywrightPoolDO: Using session ${sessionId} (${sessionReused ? 'reused' : 'new'})`);

      // Create and prepare page
      console.log(`🌐 PlaywrightPoolDO: Creating new page...`);
      page = await browser.newPage();
      await hardenPageAdvanced(page);

      // Navigate to URL with retry logic
      console.log(`🔄 PlaywrightPoolDO: Navigating to ${params.url}...`);
      await pageGotoWithRetry(page, params.url, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });

      // Wait if requested
      if (params.waitTime && params.waitTime > 0) {
        console.log(`⏳ PlaywrightPoolDO: Waiting ${params.waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }

      // Execute screenshot operation
      console.log(`🔄 PlaywrightPoolDO: Executing screenshot operation...`);
      const result = await screenshotOperation(page, params);

      if (result.success) {
        console.log(`✅ PlaywrightPoolDO: Screenshot successful`);
      } else {
        console.error(`❌ PlaywrightPoolDO: Screenshot failed: ${result.error.message}`);
      }

      return result;
    } catch (error) {
      console.error(`💥 PlaywrightPoolDO: Screenshot failed for ${params.url}:`, error);
      return {
        success: false as const,
        error: { message: String(error) },
        creditsCost: 0,
      };
    } finally {
      // Cleanup: close page and disconnect from browser (for session reuse)
      if (page && !page.isClosed()) {
        try {
          console.log(`🧹 PlaywrightPoolDO: Closing page...`);
          // await page.unroute('**/*');
          await page.close();
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing page:', closeError);
        }
      }

      if (browser) {
        try {
          console.log(
            `🔌 PlaywrightPoolDO: Closing browser session ${browser.sessionId()} (${
              sessionReused ? 'was reused' : 'newly created'
            })`,
          );
          await browser.close();
          console.log(`✅ PlaywrightPoolDO: Browser session closed successfully`);
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing browser:', closeError);
        }
      }
    }
  }

  /** Main RPC method to extract links from a URL using proper session reuse. */
  async extractLinks(params: LinksParams): Promise<LinksResult> {
    console.log(`🔗 PlaywrightPoolDO: Links extraction request for ${params.url}`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let sessionReused = false;

    try {
      // Try to reuse an existing session first
      const availableSessionId = await this.getAvailableSession();

      if (availableSessionId) {
        try {
          console.log(`🔗 PlaywrightPoolDO: Attempting to connect to session ${availableSessionId}...`);
          browser = await connect(this.env.BROWSER, availableSessionId);
          sessionReused = true;
          console.log(`✅ PlaywrightPoolDO: Successfully connected to existing session ${availableSessionId}`);
        } catch (connectError) {
          console.warn(`⚠️ PlaywrightPoolDO: Failed to connect to session ${availableSessionId}:`, connectError);
          // Continue to launch new session
        }
      }

      // If no session was reused, launch a new one (with limits check)
      if (!browser) {
        const limitsCheck = await this.canLaunchNewSession();

        if (!limitsCheck.canLaunch) {
          console.error(`🚫 PlaywrightPoolDO: Cannot launch new session: ${limitsCheck.reason}`);
          throw new Error(`Browser session limit reached: ${limitsCheck.reason}`);
        }

        console.log('🚀 PlaywrightPoolDO: Launching new browser session within limits...');
        browser = await launch(this.env.BROWSER, {
          keep_alive: KEEP_ALIVE_MS, // 10 minutes
        });
        console.log(`✅ PlaywrightPoolDO: New browser session launched with ID ${browser.sessionId()}`);
      }

      const sessionId = browser.sessionId();
      console.log(`🎯 PlaywrightPoolDO: Using session ${sessionId} (${sessionReused ? 'reused' : 'new'})`);

      // Create and prepare page
      console.log(`🌐 PlaywrightPoolDO: Creating new page...`);
      page = await browser.newPage();
      await hardenPageAdvanced(page);

      // Navigate to URL with retry logic
      console.log(`🔄 PlaywrightPoolDO: Navigating to ${params.url}...`);
      await pageGotoWithRetry(page, params.url, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });

      // Wait if requested
      if (params.waitTime && params.waitTime > 0) {
        console.log(`⏳ PlaywrightPoolDO: Waiting ${params.waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }

      // Execute links operation
      console.log(`🔄 PlaywrightPoolDO: Executing links operation...`);
      const result = await linksOperation(page, params);

      if (result.success) {
        console.log(
          `✅ PlaywrightPoolDO: Links extraction successful. Total links: ${result.data.metadata.totalLinks}`,
        );
      } else {
        console.error(`❌ PlaywrightPoolDO: Links processing failed: ${result.error.message}`);
      }

      return result;
    } catch (error) {
      console.error(`💥 PlaywrightPoolDO: Links extraction failed for ${params.url}:`, error);
      return {
        success: false as const,
        error: { message: String(error) },
        creditsCost: 0,
      };
    } finally {
      // Cleanup: close page and close browser connection
      if (page && !page.isClosed()) {
        try {
          console.log(`🧹 PlaywrightPoolDO: Closing page...`);
          await page.close();
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing page:', closeError);
        }
      }

      if (browser) {
        try {
          console.log(
            `🔌 PlaywrightPoolDO: Closing browser session ${browser.sessionId()} (${
              sessionReused ? 'was reused' : 'newly created'
            })`,
          );
          await browser.close();
          console.log(`✅ PlaywrightPoolDO: Browser session closed successfully`);
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing browser:', closeError);
        }
      }
    }
  }

  /** Main RPC method to extract HTML content from a URL using proper session reuse. */
  async extractContent(params: ContentParams): Promise<ContentResult> {
    console.log(`📄 PlaywrightPoolDO: Content extraction request for ${params.url}`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let sessionReused = false;

    try {
      // Try to reuse an existing session first
      const availableSessionId = await this.getAvailableSession();

      if (availableSessionId) {
        try {
          console.log(`🔗 PlaywrightPoolDO: Attempting to connect to session ${availableSessionId}...`);
          browser = await connect(this.env.BROWSER, availableSessionId);
          sessionReused = true;
          console.log(`✅ PlaywrightPoolDO: Successfully connected to existing session ${availableSessionId}`);
        } catch (connectError) {
          console.warn(`⚠️ PlaywrightPoolDO: Failed to connect to session ${availableSessionId}:`, connectError);
          // Continue to launch new session
        }
      }

      // If no session was reused, launch a new one (with limits check)
      if (!browser) {
        const limitsCheck = await this.canLaunchNewSession();

        if (!limitsCheck.canLaunch) {
          console.error(`🚫 PlaywrightPoolDO: Cannot launch new session: ${limitsCheck.reason}`);
          throw new Error(`Browser session limit reached: ${limitsCheck.reason}`);
        }

        console.log('🚀 PlaywrightPoolDO: Launching new browser session within limits...');
        browser = await launch(this.env.BROWSER, {
          keep_alive: KEEP_ALIVE_MS, // 10 minutes
        });
        console.log(`✅ PlaywrightPoolDO: New browser session launched with ID ${browser.sessionId()}`);
      }

      const sessionId = browser.sessionId();
      console.log(`🎯 PlaywrightPoolDO: Using session ${sessionId} (${sessionReused ? 'reused' : 'new'})`);

      // Create and prepare page
      console.log(`🌐 PlaywrightPoolDO: Creating new page...`);
      page = await browser.newPage();
      await hardenPageAdvanced(page);

      // Navigate to URL with retry logic
      console.log(`🔄 PlaywrightPoolDO: Navigating to ${params.url}...`);
      await pageGotoWithRetry(page, params.url, {
        waitUntil: 'domcontentloaded',
        timeout: 15_000,
      });

      // Wait if requested
      if (params.waitTime && params.waitTime > 0) {
        console.log(`⏳ PlaywrightPoolDO: Waiting ${params.waitTime}ms...`);
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }

      // Execute content operation
      console.log(`🔄 PlaywrightPoolDO: Executing content operation...`);
      const result = await contentOperation(page, params);

      if (result.success) {
        console.log(
          `✅ PlaywrightPoolDO: Content extraction successful. Content size: ${result.data.content.length} chars`,
        );
      } else {
        console.error(`❌ PlaywrightPoolDO: Content processing failed: ${result.error.message}`);
      }

      return result;
    } catch (error) {
      console.error(`💥 PlaywrightPoolDO: Content extraction failed for ${params.url}:`, error);
      return {
        success: false as const,
        error: { message: String(error) },
        creditsCost: 0,
      };
    } finally {
      // Cleanup: close page and close browser connection
      if (page && !page.isClosed()) {
        try {
          console.log(`🧹 PlaywrightPoolDO: Closing page...`);
          await page.close();
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing page:', closeError);
        }
      }

      if (browser) {
        try {
          console.log(
            `🔌 PlaywrightPoolDO: Closing browser session ${browser.sessionId()} (${
              sessionReused ? 'was reused' : 'newly created'
            })`,
          );
          await browser.close();
          console.log(`✅ PlaywrightPoolDO: Browser session closed successfully`);
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing browser:', closeError);
        }
      }
    }
  }

  /** Main RPC method to generate PDF from a URL using proper session reuse. */
  async generatePdf(params: PdfParams): Promise<PdfResult> {
    console.log(`📄 PlaywrightPoolDO: PDF generation request for ${params.url}`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let sessionReused = false;

    try {
      // Try to reuse an existing session first
      const availableSessionId = await this.getAvailableSession();

      if (availableSessionId) {
        try {
          console.log(`🔗 PlaywrightPoolDO: Attempting to connect to session ${availableSessionId}...`);
          browser = await connect(this.env.BROWSER, availableSessionId);
          sessionReused = true;
          console.log(`✅ PlaywrightPoolDO: Successfully connected to existing session ${availableSessionId}`);
        } catch (connectError) {
          console.warn(`⚠️ PlaywrightPoolDO: Failed to connect to session ${availableSessionId}:`, connectError);
          // Continue to launch new session
        }
      }

      // If no session was reused, launch a new one (with limits check)
      if (!browser) {
        const limitsCheck = await this.canLaunchNewSession();

        if (!limitsCheck.canLaunch) {
          console.error(`🚫 PlaywrightPoolDO: Cannot launch new session: ${limitsCheck.reason}`);
          throw new Error(`Browser session limit reached: ${limitsCheck.reason}`);
        }

        console.log('🚀 PlaywrightPoolDO: Launching new browser session within limits...');
        browser = await launch(this.env.BROWSER, {
          keep_alive: KEEP_ALIVE_MS, // 10 minutes
        });
        console.log(`✅ PlaywrightPoolDO: New browser session launched with ID ${browser.sessionId()}`);
      }

      const sessionId = browser.sessionId();
      console.log(`🎯 PlaywrightPoolDO: Using session ${sessionId} (${sessionReused ? 'reused' : 'new'})`);

      // Create and prepare page
      console.log(`🌐 PlaywrightPoolDO: Creating new page...`);
      page = await browser.newPage();
      await hardenPageAdvanced(page);

      // Execute PDF operation (with navigation handled inside)
      console.log(`🔄 PlaywrightPoolDO: Executing PDF operation...`);
      const result = await pdfOperation(page, params);

      if (result.success) {
        console.log(`✅ PlaywrightPoolDO: PDF generation successful. Size: ${result.data.metadata.size} bytes`);
      } else {
        console.error(`❌ PlaywrightPoolDO: PDF generation failed: ${result.error.message}`);
      }

      return result;
    } catch (error) {
      console.error(`💥 PlaywrightPoolDO: PDF generation failed for ${params.url}:`, error);
      return {
        success: false as const,
        error: { message: String(error) },
        creditsCost: 0,
      };
    } finally {
      // Cleanup: close page and close browser connection
      if (page && !page.isClosed()) {
        try {
          console.log(`🧹 PlaywrightPoolDO: Closing page...`);
          await page.close();
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing page:', closeError);
        }
      }

      if (browser) {
        try {
          console.log(
            `🔌 PlaywrightPoolDO: Closing browser session ${browser.sessionId()} (${
              sessionReused ? 'was reused' : 'newly created'
            })`,
          );
          await browser.close();
          console.log(`✅ PlaywrightPoolDO: Browser session closed successfully`);
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing browser:', closeError);
        }
      }
    }
  }

  /** Main RPC method to scrape elements from a URL using proper session reuse. */
  async scrapeElements(params: ScrapeParams): Promise<ScrapeResult> {
    console.log(`🔍 PlaywrightPoolDO: Scrape request for ${params.url} with ${params.elements.length} selectors`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let sessionReused = false;

    try {
      // Try to reuse an existing session first
      const availableSessionId = await this.getAvailableSession();

      if (availableSessionId) {
        try {
          console.log(`🔗 PlaywrightPoolDO: Attempting to connect to session ${availableSessionId}...`);
          browser = await connect(this.env.BROWSER, availableSessionId);
          sessionReused = true;
          console.log(`✅ PlaywrightPoolDO: Successfully connected to existing session ${availableSessionId}`);
        } catch (connectError) {
          console.warn(`⚠️ PlaywrightPoolDO: Failed to connect to session ${availableSessionId}:`, connectError);
          // Continue to launch new session
        }
      }

      // If no session was reused, launch a new one (with limits check)
      if (!browser) {
        const limitsCheck = await this.canLaunchNewSession();

        if (!limitsCheck.canLaunch) {
          console.error(`🚫 PlaywrightPoolDO: Cannot launch new session: ${limitsCheck.reason}`);
          throw new Error(`Browser session limit reached: ${limitsCheck.reason}`);
        }

        console.log('🚀 PlaywrightPoolDO: Launching new browser session within limits...');
        browser = await launch(this.env.BROWSER, {
          keep_alive: KEEP_ALIVE_MS, // 10 minutes
        });
        console.log(`✅ PlaywrightPoolDO: New browser session launched with ID ${browser.sessionId()}`);
      }

      const sessionId = browser.sessionId();
      console.log(`🎯 PlaywrightPoolDO: Using session ${sessionId} (${sessionReused ? 'reused' : 'new'})`);

      // Create and prepare page
      console.log(`🌐 PlaywrightPoolDO: Creating new page...`);
      page = await browser.newPage();
      await hardenPageAdvanced(page);

      // Execute scrape operation (with navigation handled inside)
      console.log(`🔄 PlaywrightPoolDO: Executing scrape operation...`);
      const result = await scrapeOperation(page, params);

      if (result.success) {
        console.log(`✅ PlaywrightPoolDO: Scrape successful. Elements found: ${result.data.metadata.elementsFound}`);
      } else {
        console.error(`❌ PlaywrightPoolDO: Scrape failed: ${result.error.message}`);
      }

      return result;
    } catch (error) {
      console.error(`💥 PlaywrightPoolDO: Scrape failed for ${params.url}:`, error);
      return {
        success: false as const,
        error: { message: String(error) },
        creditsCost: 0,
      };
    } finally {
      // Cleanup: close page and close browser connection
      if (page && !page.isClosed()) {
        try {
          console.log(`🧹 PlaywrightPoolDO: Closing page...`);
          await page.close();
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing page:', closeError);
        }
      }

      if (browser) {
        try {
          console.log(
            `🔌 PlaywrightPoolDO: Closing browser session ${browser.sessionId()} (${
              sessionReused ? 'was reused' : 'newly created'
            })`,
          );
          await browser.close();
          console.log(`✅ PlaywrightPoolDO: Browser session closed successfully`);
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing browser:', closeError);
        }
      }
    }
  }

  /** Main RPC method to search the web using proper session reuse. */
  async searchWeb(params: SearchParams): Promise<SearchResult> {
    console.log(`🔍 PlaywrightPoolDO: Search request for "${params.query}"`);

    let browser: Browser | null = null;
    let page: Page | null = null;
    let sessionReused = false;

    try {
      // Try to reuse an existing session first
      const availableSessionId = await this.getAvailableSession();

      if (availableSessionId) {
        try {
          console.log(`🔗 PlaywrightPoolDO: Attempting to connect to session ${availableSessionId}...`);
          browser = await connect(this.env.BROWSER, availableSessionId);
          sessionReused = true;
          console.log(`✅ PlaywrightPoolDO: Successfully connected to existing session ${availableSessionId}`);
        } catch (connectError) {
          console.warn(`⚠️ PlaywrightPoolDO: Failed to connect to session ${availableSessionId}:`, connectError);
          // Continue to launch new session
        }
      }

      // If no session was reused, launch a new one (with limits check)
      if (!browser) {
        const limitsCheck = await this.canLaunchNewSession();

        if (!limitsCheck.canLaunch) {
          console.error(`🚫 PlaywrightPoolDO: Cannot launch new session: ${limitsCheck.reason}`);
          throw new Error(`Browser session limit reached: ${limitsCheck.reason}`);
        }

        console.log('🚀 PlaywrightPoolDO: Launching new browser session within limits...');
        browser = await launch(this.env.BROWSER, {
          keep_alive: KEEP_ALIVE_MS, // 10 minutes
        });
        console.log(`✅ PlaywrightPoolDO: New browser session launched with ID ${browser.sessionId()}`);
      }

      const sessionId = browser.sessionId();
      console.log(`🎯 PlaywrightPoolDO: Using session ${sessionId} (${sessionReused ? 'reused' : 'new'})`);

      // Create and prepare page
      console.log(`🌐 PlaywrightPoolDO: Creating new page...`);
      page = await browser.newPage();
      await hardenPageAdvanced(page);

      // Execute search operation (with navigation handled inside)
      console.log(`🔄 PlaywrightPoolDO: Executing search operation...`);
      const result = await searchOperation(page, params);

      if (result.success) {
        console.log(`✅ PlaywrightPoolDO: Search successful. Results found: ${result.data.metadata.totalResults}`);
      } else {
        console.error(`❌ PlaywrightPoolDO: Search failed: ${result.error.message}`);
      }

      return result;
    } catch (error) {
      console.error(`💥 PlaywrightPoolDO: Search failed for "${params.query}":`, error);
      return {
        success: false as const,
        error: { message: String(error) },
        creditsCost: 0,
      };
    } finally {
      // Cleanup: close page and close browser connection
      if (page && !page.isClosed()) {
        try {
          console.log(`🧹 PlaywrightPoolDO: Closing page...`);
          await page.close();
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing page:', closeError);
        }
      }

      if (browser) {
        try {
          console.log(
            `🔌 PlaywrightPoolDO: Closing browser session ${browser.sessionId()} (${
              sessionReused ? 'was reused' : 'newly created'
            })`,
          );
          await browser.close();
          console.log(`✅ PlaywrightPoolDO: Browser session closed successfully`);
        } catch (closeError) {
          console.warn('PlaywrightPoolDO: Error closing browser:', closeError);
        }
      }
    }
  }

  /** Comprehensive stats endpoint with session differentiation and limits info */
  async getStats() {
    try {
      // Get Playwright-specific data
      const playwrightSessions = await sessions(this.env.BROWSER);
      const playwrightLimits = await limits(this.env.BROWSER);

      // Note: Unfortunately, there's no documented way to differentiate Playwright vs Puppeteer sessions
      // Both share the same browser binding and session pool in Cloudflare's implementation
      // The sessions() API returns all sessions regardless of which library created them

      return {
        message: 'PlaywrightPoolDO with comprehensive session management and limits monitoring',
        timestamp: new Date().toISOString(),

        // Session information (includes both Playwright and Puppeteer sessions)
        sessions: {
          total: playwrightSessions.length,
          available: playwrightSessions.filter((s) => !s.connectionId).length,
          busy: playwrightSessions.filter((s) => !!s.connectionId).length,
          details: playwrightSessions.map((s) => ({
            sessionId: s.sessionId,
            connected: !!s.connectionId,
            startTime: s.startTime,
            connectionStartTime: s.connectionStartTime,
            ageMinutes: Math.round((Date.now() - s.startTime) / 60000),
          })),
        },

        // Limits and capacity information
        limits: {
          maxConcurrentSessions: playwrightLimits.maxConcurrentSessions,
          currentActiveSessions: playwrightLimits.activeSessions.length,
          allowedBrowserAcquisitions: playwrightLimits.allowedBrowserAcquisitions,
          timeUntilNextAllowedAcquisition: playwrightLimits.timeUntilNextAllowedBrowserAcquisition,
          capacityUtilization: `${Math.round(
            (playwrightLimits.activeSessions.length / playwrightLimits.maxConcurrentSessions) * 100,
          )}%`,
        },

        // Session lifecycle info
        sessionManagement: {
          keepAliveMs: KEEP_ALIVE_MS,
          keepAliveMinutes: KEEP_ALIVE_MS / 60000,
          autoCloseAfterIdle: true,
          sessionReuseEnabled: true,
        },

        // Cross-library compatibility info
        crossLibraryInfo: {
          sharedSessionPool: true,
          recommendedApproach: 'Use same-library session reuse for best compatibility',
          riskFactors: [
            'Different DevTools protocol implementations',
            'Incompatible browser context setups',
            'Different session lifecycle management',
          ],
          fallbackStrategy: 'Always handle connection failures and launch new sessions on error',
        },

        // Note about session differentiation
        note: 'Sessions shown include both Playwright and Puppeteer sessions as they share the same browser binding pool. Cross-library session reuse is not guaranteed to work and should include proper error handling.',
      };
    } catch (error) {
      return {
        message: 'PlaywrightPoolDO with comprehensive session management',
        timestamp: new Date().toISOString(),
        error: String(error),
      };
    }
  }
}
