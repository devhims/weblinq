import type { z } from 'zod';

import type { linksInputSchema } from '@/routes/web/web.routes';

import { pageGotoWithRetry, runWithBrowser } from './browser-utils';

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
 * Browser-powered link extraction (v1)
 */
export async function linksV1(env: CloudflareBindings, params: LinksParams): Promise<LinksResult> {
  try {
    const links: Array<{ href: string; text: string }> = await runWithBrowser(env, async (page: any) => {
      // Abort heavy resources to speed things up
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const shouldAbort = ['image', 'media', 'font', 'stylesheet'].includes(req.resourceType());
        shouldAbort ? req.abort() : req.continue();
      });

      // Use retry helper for better resilience against network failures
      await pageGotoWithRetry(page, params.url, { waitUntil: 'networkidle2', timeout: 30_000 });

      if (params.waitTime && params.waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }

      // Evaluate in the browser context to gather links
      const pageLinks = await page.evaluate((visibleOnly: boolean) => {
        const isVisible = (el: Element) => {
          const rect = (el as HTMLElement).getBoundingClientRect();
          const style = window.getComputedStyle(el as HTMLElement);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };

        return Array.from(document.querySelectorAll('a[href]'))
          .filter((el) => {
            if (!visibleOnly) return true;
            return isVisible(el);
          })
          .map((a) => ({ href: (a as HTMLAnchorElement).href, text: (a.textContent || '').trim() }))
          .filter((l) => l.href.startsWith('https://') || l.href.startsWith('http://'));
      }, params.visibleLinksOnly ?? false);

      return pageLinks as Array<{ href: string; text: string }>;
    });

    const normalizeHostname = (host: string) => host.replace(/^www\./i, '');
    const baseDomain = normalizeHostname(new URL(params.url).hostname);

    const processed: LinkItem[] = links
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
      .filter((l) => (params.includeExternal === false ? l.type === 'internal' : true));

    const meta: LinksMetadata = {
      url: params.url,
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
    console.error('linksV1 error', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
