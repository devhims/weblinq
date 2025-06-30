import { htmlToText } from 'html-to-text';

import { pageGotoWithRetry, runWithBrowser } from './browser-utils';

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
 * Browser-powered element scraping (v2)
 * – Loads the target page in a hardened headless Chromium session via BrowserManagerDO
 * – For each selector provided, captures HTML, text, bounding box, and requested attributes
 * – Returns a structure optimised for the current frontend <ResultDisplay/>
 */
export async function scrapeV2(env: CloudflareBindings, params: ScrapeParams): Promise<ScrapeResult> {
  try {
    const elements: ScrapedElement[] = await runWithBrowser(env, async (page: any) => {
      /* 1️⃣  Configure page */
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const shouldAbort = ['image', 'media', 'font', 'stylesheet'].includes(req.resourceType());
        shouldAbort ? req.abort() : req.continue();
      });

      if (params.headers && Object.keys(params.headers).length > 0) {
        await page.setExtraHTTPHeaders(params.headers);
      }

      /* 2️⃣ Navigate with retry logic */
      await pageGotoWithRetry(page, params.url, { waitUntil: 'networkidle2', timeout: 30_000 });

      if (params.waitTime && params.waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }

      /* 3️⃣ Evaluate selectors in browser context */
      const results = await page.evaluate((selParams: Array<{ selector: string; attributes?: string[] }>) => {
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
          return { selector, results: nodeResults } as any;
        });
      }, params.elements);

      return results as ScrapedElement[];
    });

    // Derive plain-text using html-to-text
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

    return {
      success: true,
      data: {
        elements,
        metadata: meta,
      },
      creditsCost: CREDIT_COST,
    };
  } catch (err) {
    console.error('scrapeV2 error', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
