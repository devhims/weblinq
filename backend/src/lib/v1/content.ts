// No external sanitiser needed – we strip <script> tags via regex

import { pageGotoWithRetry, runWithBrowser } from './browser-utils';

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
 * Browser-based HTML extraction (v1)
 * – Loads the page in a headless browser via BrowserManagerDO
 * – Optionally waits for `params.waitTime` ms after networkidle2
 * – Returns **sanitised** HTML (scripts removed) plus minimal metadata
 */
export async function contentV1(env: CloudflareBindings, params: ContentParams): Promise<ContentResult> {
  try {
    /* 1️⃣  Render page HTML */
    const html = await runWithBrowser(env, async (page: any) => {
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const shouldAbort = ['image', 'media', 'font', 'stylesheet'].includes(req.resourceType());
        if (shouldAbort) {
          req.abort();
        } else {
          req.continue();
        }
      });

      // Use retry helper for better resilience against network failures
      await pageGotoWithRetry(page, params.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      if (params.waitTime && params.waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }
      return page.content();
    });

    /* 2️⃣  Strip only <script> tags to avoid XSS, keep the rest intact */
    const safeHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '');

    /* 3️⃣ Compose metadata */
    const meta: ContentMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      contentType: 'text/html',
    };

    /* 4️⃣ Response */
    return {
      success: true,
      data: {
        content: safeHtml,
        metadata: meta,
      },
      creditsCost: CREDIT_COST,
    };
  } catch (err) {
    console.error('contentV1 error', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
