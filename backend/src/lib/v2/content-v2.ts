// No external sanitiser needed – we strip <script> tags via regex

import type { Page } from '@cloudflare/playwright';

// Import v2 browser utilities for Playwright
import { hardenPageAdvanced, pageGotoWithRetry } from './browser-utils-v2';

// Parameter shape mirrored from contentInputSchema in web.routes.ts
export interface ContentParams {
  url: string;
  waitTime?: number;
}

interface ContentMetadata {
  url: string;
  timestamp: string;
  contentType: string;
}

interface ContentSuccess {
  success: true;
  data: {
    content: string;
    metadata: ContentMetadata;
  };
  creditsCost: number;
}

interface ContentFailure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

export type ContentResult = ContentSuccess | ContentFailure;

const CREDIT_COST = 1;

/**
 * High-level content extraction operation that handles page navigation and HTML extraction.
 * Used by PlaywrightPoolDO.
 */
export async function contentOperation(page: Page, params: ContentParams): Promise<ContentResult> {
  try {
    console.log(`📄 V2 Content extraction started for ${params.url}`);

    // Set up request interception for faster loading (abort heavy resources)
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      const shouldAbort = ['image', 'media', 'font', 'stylesheet'].includes(resourceType);

      if (shouldAbort) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Navigate to the URL with retry logic
    console.log(`🌐 V2 Content: Navigating to ${params.url}...`);
    await pageGotoWithRetry(page, params.url, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });

    // Wait if requested
    if (params.waitTime && params.waitTime > 0) {
      console.log(`⏳ V2 Content: Waiting ${params.waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, params.waitTime));
    }

    // Get the HTML content from the page
    console.log(`🔍 V2 Content: Extracting HTML content...`);
    const html = await page.content();

    /* Strip only <script> tags to avoid XSS, keep the rest intact */
    console.log(`🛡️ V2 Content: Sanitizing HTML (removing script tags)...`);
    const safeHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');

    /* Compose metadata */
    const meta: ContentMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      contentType: 'text/html',
    };

    console.log(`✅ V2 Content extraction successful for ${params.url}`, {
      originalSize: html.length,
      sanitizedSize: safeHtml.length,
      removedBytes: html.length - safeHtml.length,
    });

    /* Response */
    return {
      success: true,
      data: {
        content: safeHtml,
        metadata: meta,
      },
      creditsCost: CREDIT_COST,
    };
  } catch (err) {
    console.error('🚨 V2 Content extraction error:', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
