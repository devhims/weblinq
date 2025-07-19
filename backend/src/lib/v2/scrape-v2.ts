import { htmlToText } from 'html-to-text';

import type { Page } from '@cloudflare/playwright';

// Import v2 browser utilities for Playwright
import { hardenPageAdvanced, pageGotoWithRetry } from './browser-utils-v2';

export interface ScrapeParams {
  url: string;
  elements: Array<{
    selector: string;
    attributes?: string[];
  }>;
  waitTime?: number;
  headers?: Record<string, string>;
}

interface ElementAttribute {
  name: string;
  value: string;
}

interface ElementResult {
  html: string;
  text: string;
  top: number;
  left: number;
  width: number;
  height: number;
  attributes: ElementAttribute[];
}

interface ScrapedElement {
  selector: string;
  results: ElementResult[];
}

interface ScrapeMetadata {
  url: string;
  timestamp: string;
  elementsFound: number;
}

interface ScrapeSuccess {
  success: true;
  data: {
    elements: ScrapedElement[];
    metadata: ScrapeMetadata;
  };
  creditsCost: number;
}

interface ScrapeFailure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

export type ScrapeResult = ScrapeSuccess | ScrapeFailure;

const CREDIT_COST = 1;

/**
 * High-level element scraping operation that handles page navigation and element extraction.
 * Used by PlaywrightPoolDO.
 */
export async function scrapeOperation(page: Page, params: ScrapeParams): Promise<ScrapeResult> {
  try {
    console.log(`🔍 V2 Scrape operation started for ${params.url}`);
    console.log(`🎯 V2 Scrape: Processing ${params.elements.length} selectors`);

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

    // Set custom headers if provided
    if (params.headers && Object.keys(params.headers).length > 0) {
      console.log(`🔧 V2 Scrape: Setting custom headers:`, params.headers);
      await page.setExtraHTTPHeaders(params.headers);
    }

    // Navigate to the URL with retry logic
    console.log(`🌐 V2 Scrape: Navigating to ${params.url}...`);
    await pageGotoWithRetry(page, params.url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // Wait if requested
    if (params.waitTime && params.waitTime > 0) {
      console.log(`⏳ V2 Scrape: Waiting ${params.waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, params.waitTime));
    }

    // Evaluate selectors in browser context
    console.log(`🔄 V2 Scrape: Evaluating selectors in browser context...`);
    const elements = (await page.evaluate((selParams: Array<{ selector: string; attributes?: string[] }>) => {
      const collectAttributes = (el: Element, filter?: string[]) => {
        return Array.from(el.attributes)
          .filter((attr) => (filter && filter.length > 0 ? filter.includes(attr.name) : true))
          .map((attr) => ({ name: attr.name, value: attr.value }));
      };

      return selParams.map(({ selector, attributes }: { selector: string; attributes?: string[] }) => {
        const nodes = Array.from(document.querySelectorAll(selector));
        const nodeResults = nodes.slice(0, 50).map((el) => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          return {
            html: (el as HTMLElement).outerHTML,
            // placeholder; will be populated after evaluation using html-to-text
            text: '',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            attributes: collectAttributes(el, attributes),
          };
        });
        return { selector, results: nodeResults };
      });
    }, params.elements)) as ScrapedElement[];

    console.log(`📊 V2 Scrape: Found elements for ${elements.length} selectors`);

    // Derive plain-text using html-to-text
    console.log(`🔤 V2 Scrape: Converting HTML to text...`);
    for (const el of elements) {
      for (const res of el.results) {
        const plain = htmlToText(res.html, {
          wordwrap: false,
          selectors: [
            // Remove bullet/star prefixes and newlines in lists
            { selector: 'ul', format: 'unorderedList', options: { itemPrefix: '' } },
            { selector: 'ol', format: 'orderedList', options: { itemPrefix: '' } },

            // Prevent automatic upper-casing of headings
            { selector: 'h1', format: 'heading', options: { uppercase: false } },
            { selector: 'h2', format: 'heading', options: { uppercase: false } },
            { selector: 'h3', format: 'heading', options: { uppercase: false } },
            { selector: 'h4', format: 'heading', options: { uppercase: false } },
            { selector: 'h5', format: 'heading', options: { uppercase: false } },
            { selector: 'h6', format: 'heading', options: { uppercase: false } },

            // Treat list items inline to avoid line-breaks between them
            { selector: 'li', format: 'inline', options: { leadingLineBreaks: 0, trailingLineBreaks: 0 } },
          ],
        }).trim();
        res.text = plain
          .split(/\n+/)
          .map((t: string) => t.trim())
          .filter(Boolean)
          .join(', ');
      }
    }

    const meta: ScrapeMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      elementsFound: elements.reduce((acc, el) => acc + el.results.length, 0),
    };

    console.log(`✅ V2 Scrape operation successful for ${params.url}`, {
      selectorsProcessed: elements.length,
      totalElementsFound: meta.elementsFound,
    });

    return {
      success: true,
      data: {
        elements,
        metadata: meta,
      },
      creditsCost: CREDIT_COST,
    };
  } catch (err) {
    console.error('🚨 V2 Scrape operation error:', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
