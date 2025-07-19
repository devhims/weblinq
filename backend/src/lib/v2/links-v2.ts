import type { z } from 'zod';

import type { linksInputSchema } from '@/routes/web/web.routes';
import type { Page } from '@cloudflare/playwright';

// Import v2 browser utilities for Playwright
import { hardenPageAdvanced, pageGotoWithRetry } from './browser-utils-v2';

// Reuse the request schema defined in web.routes.ts
export type LinksParams = z.infer<typeof linksInputSchema>;

interface LinkItem {
  url: string;
  text: string;
  type: 'internal' | 'external';
}

interface LinksMetadata {
  url: string;
  timestamp: string;
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
}

interface LinksSuccess {
  success: true;
  data: {
    links: LinkItem[];
    metadata: LinksMetadata;
  };
  creditsCost: number;
}

interface LinksFailure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

export type LinksResult = LinksSuccess | LinksFailure;

const CREDIT_COST = 1;

/**
 * High-level links extraction operation that handles page navigation and link extraction.
 * Used by PlaywrightPoolDO.
 */
export async function linksOperation(page: Page, params: LinksParams): Promise<LinksResult> {
  try {
    console.log(`🔗 V2 Links extraction started for ${params.url}`);

    // Apply explicit defaults to ensure consistent behavior
    // This provides a safety net in case Zod defaults aren't applied properly
    const normalizedParams = {
      url: params.url,
      includeExternal: params.includeExternal ?? true, // Default to true if undefined
      waitTime: params.waitTime ?? 0, // Default to 0 if undefined
    };

    console.log(`🔧 V2 Links extraction normalized params:`, normalizedParams);

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
    await pageGotoWithRetry(page, normalizedParams.url, {
      waitUntil: 'domcontentloaded',
      timeout: 15_000,
    });

    // Wait if requested
    if (normalizedParams.waitTime && normalizedParams.waitTime > 0) {
      console.log(`⏳ V2 Links: Waiting ${normalizedParams.waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, normalizedParams.waitTime));
    }

    // Evaluate in the browser context to gather links
    console.log(`🔍 V2 Links: Extracting links from page...`);
    const pageLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a.textContent || '').trim() }))
        .filter((l) => l.href.startsWith('https://') || l.href.startsWith('http://'));
    });

    console.log(`📊 V2 Links: Found ${pageLinks.length} links on page`);

    // Process links to classify as internal/external and filter as needed
    const normalizeHostname = (host: string) => host.replace(/^www\./i, '');
    const baseDomain = normalizeHostname(new URL(normalizedParams.url).hostname);

    const processed: LinkItem[] = pageLinks
      .map((l) => {
        let linkType: 'internal' | 'external' = 'external';
        try {
          const linkUrl = new URL(l.href);
          const linkHost = normalizeHostname(linkUrl.hostname);
          linkType = linkHost === baseDomain ? 'internal' : 'external';
        } catch {
          // relative or invalid URL -> treat as internal relative link
          linkType = 'internal';
        }

        return {
          url: l.href,
          text: l.text || l.href,
          type: linkType,
        } as LinkItem;
      })
      .filter((l) => {
        // Fixed filtering logic with proper handling of boolean values
        // When includeExternal is false, only return internal links
        // When includeExternal is true (or any truthy value), return all links
        if (normalizedParams.includeExternal === false) {
          return l.type === 'internal';
        }
        return true; // Include all links by default
      });

    console.log('🔗 V2 Links processing completed:', {
      totalFound: pageLinks.length,
      afterProcessing: processed.length,
      includeExternal: normalizedParams.includeExternal,
      baseDomain,
      internalCount: processed.filter((l) => l.type === 'internal').length,
      externalCount: processed.filter((l) => l.type === 'external').length,
    });

    const meta: LinksMetadata = {
      url: normalizedParams.url,
      timestamp: new Date().toISOString(),
      totalLinks: processed.length,
      internalLinks: processed.filter((l) => l.type === 'internal').length,
      externalLinks: processed.filter((l) => l.type === 'external').length,
    };

    return {
      success: true,
      data: {
        links: processed,
        metadata: meta,
      },
      creditsCost: CREDIT_COST,
    };
  } catch (err) {
    console.error('🚨 V2 Links extraction error:', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
