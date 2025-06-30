import type { Page } from '@cloudflare/puppeteer';

import { hardenPageAdvanced, runWithBrowser } from './browser-utils';

/**
 * Input params inferred directly from the route schema so any changes there
 * immediately propagate to this implementation.
 */
export interface SearchParams {
  query: string;
  limit?: number;
}

/* -------------------------------------------------------------------------- */
/*  Multi-Engine Search Handlers                                              */
/* -------------------------------------------------------------------------- */
export interface RawSearchLink {
  title: string;
  url: string;
  snippet: string;
}

export interface InternalSearchResult {
  results: RawSearchLink[];
  usedSelector: string;
  pageTitle: string;
  pageUrl: string;
  isBlocked: boolean;
}

export type SearchEngine = 'duckduckgo' | 'startpage' | 'bing';

abstract class BaseSearchHandler {
  protected abstract getSearchUrl(query: string, limit: number): string;
  protected abstract getSelectors(): string[];
  protected abstract getSnippetSelectors(): string[];
  protected abstract extractResults(page: Page, selector: string): Promise<RawSearchLink[]>;
  public abstract cleanUrl(url: string): string;
  protected abstract isBlocked(pageTitle: string, html?: string): boolean;

  /**
   * Common search flow for all engines
   */
  async performSearch(page: Page, query: string, limit: number): Promise<InternalSearchResult> {
    const performSearchStartTime = Date.now();
    const url = this.getSearchUrl(query, limit);
    console.log(`🌐 [TIMING] ${this.constructor.name} performSearch started at ${performSearchStartTime}ms for ${url}`);

    // Enable request interception to block CSS/fonts/images for faster loading
    const interceptionStartTime = Date.now();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    const interceptionTime = Date.now() - interceptionStartTime;
    console.log(`🌐 [TIMING] ${this.constructor.name} request interception setup took ${interceptionTime}ms`);

    const navigationStartTime = Date.now();
    console.log(`🌐 [TIMING] ${this.constructor.name} starting navigation to ${url} at ${navigationStartTime}ms`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 });

    const navigationTime = Date.now() - navigationStartTime;
    console.log(`✅ [TIMING] ${this.constructor.name} page navigation completed in ${navigationTime}ms`);

    // Give page extra time if results haven't loaded yet
    const selectors = this.getSelectors();
    const selectorWaitStartTime = Date.now();
    console.log(
      `🔍 [TIMING] ${this.constructor.name} waiting for selectors: ${selectors.join(
        ', ',
      )} at ${selectorWaitStartTime}ms`,
    );

    const hasContent = await page
      .waitForSelector(selectors.join(', '), { timeout: 1500 })
      .then(() => {
        const selectorFoundTime = Date.now() - selectorWaitStartTime;
        console.log(`✅ [TIMING] ${this.constructor.name} selectors found in ${selectorFoundTime}ms`);
        return true;
      })
      .catch(() => {
        const selectorTimeoutTime = Date.now() - selectorWaitStartTime;
        console.log(`⚠️ [TIMING] ${this.constructor.name} selectors timeout after ${selectorTimeoutTime}ms`);
        return false;
      });

    if (!hasContent) {
      const extraWaitStartTime = Date.now();
      console.log(`⏳ [TIMING] ${this.constructor.name} adding extra 400ms wait at ${extraWaitStartTime}ms`);
      await new Promise((res) => setTimeout(res, 400));
      const extraWaitTime = Date.now() - extraWaitStartTime;
      console.log(`⏳ [TIMING] ${this.constructor.name} extra wait completed in ${extraWaitTime}ms`);
    }

    let results: RawSearchLink[] = [];
    let usedSelector = '';

    const extractionStartTime = Date.now();
    console.log(`🎯 [TIMING] ${this.constructor.name} starting result extraction at ${extractionStartTime}ms`);

    for (const selector of selectors) {
      try {
        const selectorStartTime = Date.now();
        const selectorResults = await this.extractResults(page, selector);
        const selectorTime = Date.now() - selectorStartTime;

        if (selectorResults.length > 0) {
          results = selectorResults;
          usedSelector = selector;
          console.log(
            `🎯 [TIMING] ${this.constructor.name} found ${selectorResults.length} results using: ${selector} in ${selectorTime}ms`,
          );
          break;
        } else {
          console.log(`🎯 [TIMING] ${this.constructor.name} no results with selector: ${selector} (${selectorTime}ms)`);
        }
      } catch (error) {
        console.log(`❌ [TIMING] ${this.constructor.name} selector error: ${selector} - ${error}`);
        continue;
      }
    }

    const extractionTime = Date.now() - extractionStartTime;
    console.log(`🎯 [TIMING] ${this.constructor.name} result extraction completed in ${extractionTime}ms`);

    // Check for blocking
    const blockingCheckStartTime = Date.now();
    const pageTitle = await page.title();
    const html = await page.content();
    const isBlocked = this.isBlocked(pageTitle, html);
    const blockingCheckTime = Date.now() - blockingCheckStartTime;
    console.log(
      `🔐 [TIMING] ${this.constructor.name} blocking check completed in ${blockingCheckTime}ms (blocked: ${isBlocked})`,
    );

    if (isBlocked) {
      throw new Error('Page blocked or CAPTCHA detected');
    }

    const totalPerformSearchTime = Date.now() - performSearchStartTime;
    console.log(`🌐 [TIMING] ${this.constructor.name} performSearch completed in ${totalPerformSearchTime}ms total`);

    return {
      results,
      usedSelector,
      pageTitle,
      pageUrl: page.url(),
      isBlocked: false,
    };
  }
}

class DuckDuckGoHandler extends BaseSearchHandler {
  protected getSearchUrl(query: string, limit: number): string {
    // DuckDuckGo HTML doesn't officially support result count, but we can try 's' parameter
    return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${limit}`;
  }

  protected getSelectors(): string[] {
    return ['.result__title a', '.web-result__title a', '.result__a', 'h3 a[href^="http"]'];
  }

  protected getSnippetSelectors(): string[] {
    return ['.result__snippet', '.web-result__snippet', '.result__description', '.snippet'];
  }

  protected async extractResults(page: Page, selector: string): Promise<RawSearchLink[]> {
    return page.$$eval(selector, (links) => {
      return (links as any[]).map((a: any) => {
        const title = a.textContent?.trim() ?? '';
        const url = a.href;

        const snippet = (() => {
          const result = a.closest('.result, .web-result, .result__body') || a.parentElement;
          if (!result) return '';

          const snippetSelectors = ['.result__snippet', '.web-result__snippet', '.result__description', '.snippet'];

          for (const sel of snippetSelectors) {
            const snippetEl = result.querySelector(sel);
            if (snippetEl?.textContent?.trim()) {
              return snippetEl.textContent.trim();
            }
          }

          const textNodes = Array.from(result.querySelectorAll('*'))
            .map((el: unknown) => (el as Element).textContent?.trim())
            .filter((text): text is string => text != null && text.length > 20 && text !== title)
            .sort((a, b) => b.length - a.length);

          return textNodes[0] || '';
        })();

        return { title, url, snippet };
      });
    });
  }

  public cleanUrl(url: string): string {
    // Handle DuckDuckGo redirect URLs in various formats:
    // - https://duckduckgo.com/l/?uddg=...
    // - //duckduckgo.com/l/?uddg=...
    // - http://duckduckgo.com/l/?uddg=...
    if (url.includes('duckduckgo.com/l/?uddg=')) {
      try {
        const uddgParam = url.split('uddg=')[1]?.split('&')[0];
        if (uddgParam) {
          const decodedUrl = decodeURIComponent(uddgParam);
          // Ensure the decoded URL has a protocol
          if (decodedUrl.startsWith('//')) {
            return `https:${decodedUrl}`;
          }
          if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
            return `https://${decodedUrl}`;
          }
          return decodedUrl;
        }
      } catch (error) {
        console.warn('Failed to decode DuckDuckGo URL:', url, error);
        return url;
      }
    }

    // Handle protocol-relative URLs
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    return url;
  }

  protected isBlocked(pageTitle: string, html?: string): boolean {
    const title = pageTitle.toLowerCase();
    return (
      title.includes('verification') ||
      title.includes('captcha') ||
      title.includes('blocked') ||
      (html != null && html.length < 1000)
    );
  }
}

class StartpageHandler extends BaseSearchHandler {
  protected getSearchUrl(query: string, _limit: number): string {
    // Revert to original URL format - /do/search caused 3x slower extraction (617ms → 2112ms)
    // Keep the removal of &num=${limit} as Startpage doesn't support result limiting
    return `https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}&cat=web&pl=opensearch`;
  }

  protected getSelectors(): string[] {
    // Reordered: Put working selector first to avoid 1.4s of failed attempts
    return ['.result', '.w-gl__result', '.result-item', '.search-result', '[data-testid="result"]'];
  }

  protected getSnippetSelectors(): string[] {
    return ['.w-gl__description', '.result-snippet', '.search-item-snippet', '.result-description'];
  }

  protected async extractResults(page: Page, selector: string): Promise<RawSearchLink[]> {
    const extractionStartTime = Date.now();
    console.log(`🎯 [TIMING] StartpageHandler extraction starting for selector: ${selector}`);

    const results = await page.$$eval(selector, (elements) => {
      return (elements as any[])
        .map((element: any) => {
          // OPTIMIZED: Find URL first with early exit
          const linkEl = element.querySelector('a[href^="http"]');
          if (!linkEl?.href) return null; // Early exit if no valid URL
          const url = linkEl.href;

          // OPTIMIZED: Simplified title extraction
          let title = '';
          const titleEl = element.querySelector('h3, .title, .result-title') || linkEl;
          if (titleEl?.textContent?.trim()) {
            title = titleEl.textContent.trim();
            // Quick validation
            if (title.length <= 3 || title.includes('css-')) {
              title = '';
            }
          }

          // Quick fallback from URL if no title
          if (!title) {
            try {
              title = new URL(url).hostname.replace('www.', '');
            } catch {
              title = 'Search Result';
            }
          }

          // OPTIMIZED: Simplified snippet extraction
          let snippet = '';
          const snippetEl = element.querySelector('.w-gl__description, .result-snippet, .description, p');
          if (snippetEl?.textContent?.trim() && snippetEl.textContent.trim().length > 10) {
            snippet = snippetEl.textContent.trim();
          } else {
            snippet = `Search result from ${title}`;
          }

          return { title, url, snippet };
        })
        .filter((result): result is RawSearchLink => result !== null && result.title.length > 3);
    });

    const extractionTime = Date.now() - extractionStartTime;
    console.log(
      `🎯 [TIMING] StartpageHandler extraction completed for ${selector} in ${extractionTime}ms (found ${results.length} results)`,
    );

    return results;
  }

  public cleanUrl(url: string): string {
    return url; // Startpage typically provides clean URLs
  }

  protected isBlocked(pageTitle: string): boolean {
    const title = pageTitle.toLowerCase();
    return title.includes('verification') || title.includes('captcha') || title.includes('blocked');
  }
}

class BingHandler extends BaseSearchHandler {
  protected getSearchUrl(query: string, limit: number): string {
    return `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${limit}`;
  }

  protected getSelectors(): string[] {
    return ['.b_algo', '.b_result', '.b_algoheader'];
  }

  protected getSnippetSelectors(): string[] {
    return ['.b_caption p', '.b_snippet', '.b_descript'];
  }

  protected async extractResults(page: Page, selector: string): Promise<RawSearchLink[]> {
    return page.$$eval(selector, (elements) => {
      return (elements as any[])
        .map((element: any) => {
          let title = '';
          let url = '';
          let snippet = '';

          // Find title and URL
          const titleSelectors = ['h2 a', '.b_algoheader a', '.b_title a'];
          for (const titleSel of titleSelectors) {
            const titleEl = element.querySelector(titleSel);
            if (titleEl?.textContent?.trim() && titleEl.href) {
              title = titleEl.textContent.trim();
              url = titleEl.href;
              break;
            }
          }

          if (!title || !url || !url.startsWith('http')) return null;

          // Find snippet
          const snippetSelectors = ['.b_caption p', '.b_snippet', '.b_descript'];
          for (const snippetSel of snippetSelectors) {
            const snippetEl = element.querySelector(snippetSel);
            if (snippetEl?.textContent?.trim()) {
              snippet = snippetEl.textContent.trim();
              break;
            }
          }

          if (!snippet) {
            snippet = `Search result from ${title.toLowerCase()}`;
          }

          return { title, url, snippet };
        })
        .filter((result): result is RawSearchLink => result !== null);
    });
  }

  public cleanUrl(url: string): string {
    const cleanStartTime = Date.now();

    if (!url.includes('bing.com')) {
      const cleanTime = Date.now() - cleanStartTime;
      console.log(`🧹 [TIMING] BingHandler cleanUrl (no processing needed) took ${cleanTime}ms`);
      return url;
    }

    // Handle Bing redirect patterns
    if (url.includes('/ck/a?')) {
      const patterns = [/[&?]u=([^&]+)/, /[&?]url=([^&]+)/, /[&?]p=([^&]+)/];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          try {
            const decodingStartTime = Date.now();
            let decoded = decodeURIComponent(match[1]);

            // Check if it's base64 encoded (Bing often uses this)
            if (!decoded.startsWith('http') && decoded.match(/^[A-Z0-9+/]+=*$/i)) {
              try {
                // Look for the HTTP pattern in base64 (aHR0cHM = "https")
                const httpPattern = decoded.indexOf('aHR0cHM');
                if (httpPattern !== -1) {
                  // Extract the URL part starting from the HTTP pattern
                  const urlPart = decoded.substring(httpPattern);

                  // Find where the URL ends (before fragment or query params that are part of tracking)
                  // Look for common delimiters that separate the actual URL from tracking data
                  let cleanUrlPart = urlPart;
                  const delimiters = ['#On', '#:', '?utm', '&utm', '#utm', '#%3A'];

                  for (const delimiter of delimiters) {
                    const delimiterIndex = cleanUrlPart.indexOf(delimiter);
                    if (delimiterIndex !== -1) {
                      cleanUrlPart = cleanUrlPart.substring(0, delimiterIndex);
                      break;
                    }
                  }

                  // Add padding if needed for proper base64 decoding
                  while (cleanUrlPart.length % 4 !== 0) {
                    cleanUrlPart += '=';
                  }

                  const base64Decoded = atob(cleanUrlPart);
                  console.log(`🔍 Bing base64 decoded: ${base64Decoded}`);

                  // Clean the decoded URL by removing tracking fragments
                  let cleanDecoded = base64Decoded;
                  if (cleanDecoded.includes('#:~:')) {
                    cleanDecoded = cleanDecoded.split('#:~:')[0];
                  } else if (cleanDecoded.includes('#')) {
                    // Only remove fragment if it looks like tracking (contains certain patterns)
                    const fragment = cleanDecoded.split('#')[1];
                    if (
                      fragment &&
                      (fragment.includes('text=') || fragment.includes('utm') || fragment.includes('source='))
                    ) {
                      cleanDecoded = cleanDecoded.split('#')[0];
                    }
                  }

                  decoded = cleanDecoded;
                } else {
                  // Fallback: try to decode the entire string
                  const base64Decoded = atob(decoded);
                  // Then URL decode if needed
                  decoded = base64Decoded.includes('%') ? decodeURIComponent(base64Decoded) : base64Decoded;
                  console.log(`🔍 Bing base64 decoded (fallback): ${decoded}`);

                  // Extract just the URL part if it contains tracking
                  if (decoded.startsWith('http')) {
                    decoded = decoded.split('#')[0].split('?')[0];
                  }
                }
              } catch (base64Error) {
                console.warn(`Failed to decode base64: ${base64Error}`);
              }
            }

            if (decoded.startsWith('http')) {
              const decodingTime = Date.now() - decodingStartTime;
              const totalCleanTime = Date.now() - cleanStartTime;
              console.log(
                `🧹 [TIMING] BingHandler cleanUrl base64 decoding took ${decodingTime}ms, total ${totalCleanTime}ms`,
              );
              return decoded;
            }
          } catch {
            continue;
          }
        }
      }
    } else if (url.includes('/cr?') && url.includes('&r=')) {
      const match = url.match(/[&?]r=([^&]+)/);
      if (match) {
        try {
          const decodingStartTime = Date.now();
          let decoded = decodeURIComponent(match[1]);

          // Check for base64 encoding here too
          if (!decoded.startsWith('http') && decoded.match(/^[A-Z0-9+/]+=*$/i)) {
            try {
              decoded = decodeURIComponent(atob(decoded));
              console.log(`🔍 Bing base64 decoded (cr): ${decoded}`);
            } catch (base64Error) {
              console.warn(`Failed to decode base64 (cr): ${base64Error}`);
            }
          }

          const decodingTime = Date.now() - decodingStartTime;
          const totalCleanTime = Date.now() - cleanStartTime;
          console.log(`🧹 [TIMING] BingHandler cleanUrl cr decoding took ${decodingTime}ms, total ${totalCleanTime}ms`);
          return decoded.startsWith('http') ? decoded : url;
        } catch {
          const cleanTime = Date.now() - cleanStartTime;
          console.log(`🧹 [TIMING] BingHandler cleanUrl cr fallback took ${cleanTime}ms`);
          return url;
        }
      }
    } else if (url.includes('target=')) {
      const match = url.match(/[&?]target=([^&]+)/);
      if (match) {
        try {
          const decodingStartTime = Date.now();
          let decoded = decodeURIComponent(match[1]);

          // Check for base64 encoding here too
          if (!decoded.startsWith('http') && decoded.match(/^[A-Z0-9+/]+=*$/i)) {
            try {
              decoded = decodeURIComponent(atob(decoded));
              console.log(`🔍 Bing base64 decoded (target): ${decoded}`);
            } catch (base64Error) {
              console.warn(`Failed to decode base64 (target): ${base64Error}`);
            }
          }

          const decodingTime = Date.now() - decodingStartTime;
          const totalCleanTime = Date.now() - cleanStartTime;
          console.log(
            `🧹 [TIMING] BingHandler cleanUrl target decoding took ${decodingTime}ms, total ${totalCleanTime}ms`,
          );
          return decoded.startsWith('http') ? decoded : url;
        } catch {
          const cleanTime = Date.now() - cleanStartTime;
          console.log(`🧹 [TIMING] BingHandler cleanUrl target fallback took ${cleanTime}ms`);
          return url;
        }
      }
    }

    const cleanTime = Date.now() - cleanStartTime;
    console.log(`🧹 [TIMING] BingHandler cleanUrl no processing took ${cleanTime}ms`);
    return url;
  }

  protected isBlocked(pageTitle: string): boolean {
    const title = pageTitle.toLowerCase();
    return title.includes('verification') || title.includes('captcha') || title.includes('blocked');
  }
}

class MultiEngineSearchHandler {
  private handlers: Map<SearchEngine, BaseSearchHandler>;
  private recentMonthRegexCache: Record<number, RegExp> = {};

  constructor() {
    this.handlers = new Map<SearchEngine, BaseSearchHandler>([
      ['duckduckgo', new DuckDuckGoHandler()],
      ['startpage', new StartpageHandler()],
      ['bing', new BingHandler()],
    ]);
  }

  /**
   * Enhanced relevance scoring that rewards comprehensive matches in both title and snippet
   */
  // Configurable scoring weights for easy tuning and A/B testing
  private static readonly SCORING_WEIGHTS = {
    // Core matching scores
    titleExact: 12,
    titlePartial: 6, // Reduced for word-boundary preference
    snippetExact: 6,
    snippetPartial: 3, // Reduced for word-boundary preference

    // URL/Domain scoring (enhanced for brand authority)
    urlExactDomain: 40, // Increased from 25 for stronger brand preference
    urlPrefixSuffix: 15,
    urlSubstring: 10,
    urlPath: 8,

    // Synergy and coverage bonuses
    synergyPerArea: 6,
    coverageScale: 20,
    allThreeAreas: 15,
    twoAreasWithUrl: 10,
    titleAndSnippet: 8,
    keywordDiversity: 4,

    // Quality adjustments
    authorityDomain: 3,
    brandAuthorityBonus: 20, // Extra bonus when domain exactly matches prominent query term
    longTitlePenalty: -3,
    tinySnippetPenalty: -1,
    goodSnippetBonus: 2,

    // Recency bonuses (progressive tiers)
    recencyVeryRecent: 20, // < 48 hours
    recencyRecent: 15, // < 1 week
    recencyModerate: 10, // < 1 month
    recencyFairly: 5, // < 6 months

    // Caps to prevent score inflation
    maxSynergyBonus: 30,
    maxTotalScore: 150,
  };

  /**
   * Escape special regex characters in search terms
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Helper to get recent months with wrap-around for year boundaries
   */
  private getRecentMonths(currentMonth: number): string[] {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const result: string[] = [];
    for (let i = 0; i < 4; i++) {
      // Last 4 months including current
      const monthIndex = (currentMonth - i + 12) % 12; // Handle wrap-around
      result.push(monthNames[monthIndex]);
    }
    return result;
  }

  /**
   * Cached regex compilation for recent month patterns (performance optimization)
   */
  private getRecentMonthRegex(currentMonth: number, currentYear: number): RegExp {
    if (!this.recentMonthRegexCache[currentMonth]) {
      const months = this.getRecentMonths(currentMonth).join('|');
      this.recentMonthRegexCache[currentMonth] = new RegExp(`\\b(${months})[a-z]*\\s+${currentYear}\\b`, 'i');
    }
    return this.recentMonthRegexCache[currentMonth];
  }

  /**
   * Extract root domain from hostname for secure domain matching
   * Examples:
   * - "www.cloudflare.com" → "cloudflare"
   * - "api.cloudflare.com" → "cloudflare"
   * - "cloudflare-fake.com" → "cloudflare-fake"
   */
  private extractRootDomain(hostname: string): string {
    // Remove www. prefix if present
    const cleaned = hostname.replace(/^www\./, '');

    // Split by dots and get second-to-last part (root domain)
    const parts = cleaned.split('.');
    if (parts.length >= 2) {
      return parts[parts.length - 2]; // Second-to-last part is root domain
    }
    return cleaned; // Fallback to original if parsing fails
  }

  /**
   * Enhanced recency detection with tiered bonuses based on content age
   */
  private calculateRecencyBonus(result: RawSearchLink): number {
    const snippet = result.snippet?.toLowerCase() || '';
    const url = result.url.toLowerCase();
    const W = MultiEngineSearchHandler.SCORING_WEIGHTS;

    // 🎯 ABSOLUTE DATE PARSING: Catch explicit dates like "2024-12-05", "28 Jun 2025"
    const absoluteDateISO =
      snippet.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/) ||
      url.match(/\/(20\d{2})\/(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])\//);

    const absoluteDateText = snippet.match(
      /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(20\d{2})\b/i,
    );

    if (absoluteDateISO || absoluteDateText) {
      try {
        let pubDate: Date | null = null;
        if (absoluteDateISO) {
          pubDate = new Date(
            `${absoluteDateISO[1]}-${absoluteDateISO[2].padStart(2, '0')}-${absoluteDateISO[3].padStart(2, '0')}`,
          );
        } else if (absoluteDateText) {
          const monthMap: Record<string, number> = {
            jan: 0,
            feb: 1,
            mar: 2,
            apr: 3,
            may: 4,
            jun: 5,
            jul: 6,
            aug: 7,
            sep: 8,
            oct: 9,
            nov: 10,
            dec: 11,
          };
          const monthName = absoluteDateText[2].toLowerCase().slice(0, 3);
          pubDate = new Date(
            Number.parseInt(absoluteDateText[3]),
            monthMap[monthName],
            Number.parseInt(absoluteDateText[1]),
          );
        }

        if (pubDate && !Number.isNaN(pubDate.getTime())) {
          const ageDays = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
          if (ageDays < 2) return W.recencyVeryRecent;
          if (ageDays < 7) return W.recencyRecent;
          if (ageDays < 30) return W.recencyModerate;
          if (ageDays < 180) return W.recencyFairly;
        }
      } catch {
        // Fall through to relative date patterns
      }
    }

    // Very recent (< 48 hours) - highest priority
    const veryRecentPatterns = [
      /\b([1-9]|1\d|2[0-4])\s*(hours?|hrs?)\s+ago\b/,
      /\b(today|this morning|this afternoon)\b/,
      /\byesterday\b/,
    ];

    if (veryRecentPatterns.some((pattern) => pattern.test(snippet))) {
      return W.recencyVeryRecent;
    }

    // Recent (< 1 week)
    const recentPatterns = [/\b([1-6])\s*(days?)\s+ago\b/, /\b(this week|few days ago)\b/];

    if (recentPatterns.some((pattern) => pattern.test(snippet))) {
      return W.recencyRecent;
    }

    // Moderate (< 1 month)
    const moderatePatterns = [/\b([1-3])\s*(weeks?)\s+ago\b/, /\b(this month|last week)\b/];

    if (moderatePatterns.some((pattern) => pattern.test(snippet))) {
      return W.recencyModerate;
    }

    // Fairly recent (< 6 months) - look for current year or recent months
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-based (0=Jan, 11=Dec)

    // Current year in URL is a good recency signal
    if (url.includes(`/${currentYear}/`) || url.includes(`-${currentYear}-`)) {
      return W.recencyFairly;
    }

    // 🔧 OPTIMIZED: Use cached regex for recent month patterns
    const recentMonthPattern = this.getRecentMonthRegex(currentMonth, currentYear);

    if (recentMonthPattern.test(snippet)) {
      return W.recencyFairly;
    }

    return 0; // No recency bonus
  }

  /**
   * Enhanced scoring with word-boundary matching and configurable weights
   */
  private calculateScore(result: RawSearchLink, query: string): number {
    const scoreStartTime = Date.now();

    // Tokenize query into words (improved word boundary detection)
    // Allow important 2-character terms like "AI", "UK", "JS", "Go"
    const importantShortTerms = new Set(['ai', 'uk', 'js', 'go', 'ui', 'ux', 'vr', 'ar', 'ml', 'dl', 'it', 'io']);
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2 || importantShortTerms.has(word));

    if (queryWords.length === 0) {
      const scoreTime = Date.now() - scoreStartTime;
      console.log(`🎯 [TIMING] calculateScore (no query words) took ${scoreTime}ms`);
      return 0;
    }

    const W = MultiEngineSearchHandler.SCORING_WEIGHTS;
    const titleLower = result.title.toLowerCase();
    const snippetLower = result.snippet?.toLowerCase() || '';

    // Extract URL components for scoring
    let urlHost = '';
    let urlPath = '';
    try {
      const urlObj = new URL(result.url);
      urlHost = urlObj.hostname.replace('www.', '').toLowerCase();
      urlPath = urlObj.pathname.toLowerCase();
    } catch {
      urlHost = result.url.toLowerCase();
    }

    let score = 0;
    let synergyBonus = 0;
    let titleMatches = 0;
    let snippetMatches = 0;
    let urlMatches = 0;
    const titleMatchedWords = new Set<string>();
    const snippetMatchedWords = new Set<string>();
    const urlMatchedWords = new Set<string>();

    // Calculate matches for each query word with improved word-boundary detection
    for (const word of queryWords) {
      let titleMatchFound = false;
      let snippetMatchFound = false;
      let urlMatchFound = false;

      // 🎯 TITLE MATCHES: Word-boundary preference
      const titleWordBoundary = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
      if (titleWordBoundary.test(result.title)) {
        titleMatchFound = true;
        titleMatches++;
        titleMatchedWords.add(word);
        score += W.titleExact; // Precise word match
      } else if (titleLower.includes(word)) {
        titleMatchFound = true;
        titleMatches++;
        titleMatchedWords.add(word);
        score += W.titlePartial; // Substring match (lower score)
      }

      // 🎯 SNIPPET MATCHES: Word-boundary preference
      const snippetWordBoundary = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'i');
      if (snippetWordBoundary.test(result.snippet || '')) {
        snippetMatchFound = true;
        snippetMatches++;
        snippetMatchedWords.add(word);
        score += W.snippetExact; // Precise word match
      } else if (snippetLower.includes(word)) {
        snippetMatchFound = true;
        snippetMatches++;
        snippetMatchedWords.add(word);
        score += W.snippetPartial; // Substring match (lower score)
      }

      // 🌐 URL/DOMAIN MATCHES: Critical for brand searches with security
      const rootDomain = this.extractRootDomain(urlHost);
      const hasUrlMatch = rootDomain.includes(word) || urlPath.includes(word);

      if (hasUrlMatch) {
        urlMatchFound = true;
        urlMatches++;
        urlMatchedWords.add(word);

        // 🔒 SECURE Domain match hierarchy (root domain only)
        if (rootDomain === word) {
          score += W.urlExactDomain; // Exact root domain match (e.g., "cloudflare" matches cloudflare.com)
        } else if (rootDomain.startsWith(word) || rootDomain.endsWith(word)) {
          score += W.urlPrefixSuffix; // Root domain prefix/suffix match
        } else if (rootDomain.includes(word)) {
          score += W.urlSubstring; // Root domain substring match
        } else if (urlPath.includes(word)) {
          score += W.urlPath; // URL path match (lower priority)
        }
      }

      // 🎯 SYNERGY BONUSES: Extra points for multi-area matches (with cap)
      const matchAreas = [titleMatchFound, snippetMatchFound, urlMatchFound].filter(Boolean).length;
      if (matchAreas >= 2) {
        synergyBonus += matchAreas * W.synergyPerArea;
      }
    }

    // Apply synergy bonus with cap
    score += Math.min(synergyBonus, W.maxSynergyBonus);

    // 🚀 COMPREHENSIVE MATCH BONUS: When multiple areas have matches
    const totalMatches = titleMatches + snippetMatches + urlMatches;
    if (totalMatches > 0) {
      const matchCoverage = totalMatches / (queryWords.length * 3); // 3 areas: title, snippet, URL
      score += Math.floor(matchCoverage * W.coverageScale);

      // Area combination bonuses
      if (titleMatches > 0 && snippetMatches > 0 && urlMatches > 0) {
        score += W.allThreeAreas; // All three areas match
      } else if ((titleMatches > 0 && urlMatches > 0) || (snippetMatches > 0 && urlMatches > 0)) {
        score += W.twoAreasWithUrl; // Two areas including URL
      } else if (titleMatches > 0 && snippetMatches > 0) {
        score += W.titleAndSnippet; // Title and snippet both match
      }
    }

    // 📈 DIVERSITY BONUS: Reward when different query words match across areas
    const uniqueWords = new Set([...titleMatchedWords, ...snippetMatchedWords, ...urlMatchedWords]);
    if (uniqueWords.size > 1) {
      score += (uniqueWords.size - 1) * W.keywordDiversity;
    }

    // 🏆 AUTHORITY SIGNALS: Domain quality indicators
    if (urlHost.split('.').length === 2 && !urlHost.includes('-') && !urlHost.includes('_')) {
      score += W.authorityDomain;
    }

    // 🎯 BRAND AUTHORITY: Extra bonus when domain exactly matches prominent query term
    const rootDomain = this.extractRootDomain(urlHost);
    // Check if domain matches any query word (usually indicates official brand site)
    for (const word of queryWords) {
      if (rootDomain === word) {
        score += W.brandAuthorityBonus;
        break; // Only apply once per result
      }
    }

    // ⏰ RECENCY BONUS: Scaled bonus to prevent fresh-but-irrelevant from beating quality
    const recencyStartTime = Date.now();
    const rawRecencyBonus = this.calculateRecencyBonus(result);
    const recencyTime = Date.now() - recencyStartTime;

    if (rawRecencyBonus > 0) {
      // Scale recency by quality: higher-quality content gets larger recency boost
      const qualityFactor = Math.min(1.0, Math.max(0.3, score / 50)); // 30%-100% scaling
      score += Math.floor(rawRecencyBonus * qualityFactor);
    }

    // 📏 QUALITY ADJUSTMENTS
    if (result.title.length > 100) {
      score += W.longTitlePenalty;
    }

    if (result.snippet && result.snippet.length > 50 && result.snippet.length < 300) {
      score += W.goodSnippetBonus;
    }

    if (result.snippet && result.snippet.length < 20) {
      score += W.tinySnippetPenalty;
    }

    // Apply maximum score cap and ensure non-negative
    const finalScore = Math.max(0, Math.min(score, W.maxTotalScore));

    const totalScoreTime = Date.now() - scoreStartTime;
    if (totalScoreTime > 5) {
      // Only log if scoring takes more than 5ms
      console.log(
        `🎯 [TIMING] calculateScore took ${totalScoreTime}ms (recency: ${recencyTime}ms) for "${result.title}"`,
      );
    }

    return finalScore;
  }

  private async runEnginesInParallel(
    page: Page,
    engines: SearchEngine[],
    query: string,
    limit: number,
  ): Promise<{
    results: Array<RawSearchLink & { source: SearchEngine }>;
    engineResults: Record<string, any>;
  }> {
    const allResults: Array<RawSearchLink & { source: SearchEngine }> = [];
    const engineResults: Record<string, any> = {};

    // Create multiple pages for parallel processing
    const browser = page.browser();
    const additionalPages: Page[] = [];

    try {
      const pageCreationStartTime = Date.now();
      console.log(
        `🚀 [TIMING] Creating additional browser pages for ${engines.length} engines at ${pageCreationStartTime}ms`,
      );

      // Create additional pages for parallel processing (we already have one page)
      for (let i = 1; i < engines.length; i++) {
        const pageStart = Date.now();
        const newPage = await browser.newPage();
        const pageCreated = Date.now();
        console.log(`🚀 [TIMING] Created page ${i} in ${pageCreated - pageStart}ms`);

        // Apply same hardening as the original page
        const hardeningStart = Date.now();
        await hardenPageAdvanced(newPage);
        const hardeningEnd = Date.now();
        console.log(`🚀 [TIMING] Hardened page ${i} in ${hardeningEnd - hardeningStart}ms`);

        additionalPages.push(newPage);
      }

      const pageCreationEndTime = Date.now();
      console.log(`🚀 [TIMING] All pages created and hardened in ${pageCreationEndTime - pageCreationStartTime}ms`);

      const pages = [page, ...additionalPages];

      // Calculate per-engine limit to reduce parsing overhead while accounting for deduplication
      // Request slightly more per engine to ensure enough unique results after deduplication
      const perEngineLimit = Math.max(3, Math.ceil(limit * 0.8)); // At least 3, usually ~80% of requested limit
      console.log(
        `💡 [OPTIMIZATION] Requesting ${perEngineLimit} results per engine (vs default ~10-20) for final limit of ${limit}`,
      );

      // Execute searches in parallel using Promise.allSettled for graceful error handling
      const parallelSearchStartTime = Date.now();
      console.log(`🚀 [TIMING] Starting parallel search execution at ${parallelSearchStartTime}ms`);

      const searchPromises = engines.map(async (engine, index) => {
        const enginePage = pages[index];
        const handler = this.handlers.get(engine);

        if (!handler) {
          console.warn(`No handler found for engine: ${engine}`);
          return { engine, error: 'No handler found', success: false };
        }

        try {
          const engineStartTime = Date.now();
          console.log(
            `🔍 [TIMING] Starting ${engine} search on page ${
              index + 1
            } at ${engineStartTime}ms (requesting ${perEngineLimit} results)`,
          );

          // Add timeout to prevent any single engine from taking too long
          const searchPromise = handler.performSearch(enginePage, query, perEngineLimit);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${engine} search timeout after 8 seconds`)), 8000),
          );

          const result = await Promise.race([searchPromise, timeoutPromise]);
          const searchTime = Date.now() - engineStartTime;

          console.log(`✅ [TIMING] ${engine} completed in ${searchTime}ms, found ${result.results.length} raw results`);

          // Filter and clean results (no need to slice since we requested the right amount)
          const filteringStartTime = Date.now();
          const filtered = result.results
            .filter((r) => {
              // Basic validation
              if (!r.url || !r.url.startsWith('http') || r.title.length <= 3) {
                return false;
              }

              // More specific filtering instead of generic engine name check
              const isSearchEnginePage =
                r.url.includes('duckduckgo.com/html') ||
                r.url.includes('startpage.com/sp/search') ||
                r.url.includes('bing.com/search') ||
                r.url.includes('privacy');

              return !isSearchEnginePage;
            })
            .map((r) => ({
              title: r.title,
              url: handler.cleanUrl(r.url),
              snippet: r.snippet || '',
              source: engine,
            }));

          const filteringTime = Date.now() - filteringStartTime;
          console.log(`🔍 [TIMING] ${engine} filtering and URL cleaning took ${filteringTime}ms`);

          return {
            engine,
            success: true,
            results: filtered,
            metadata: {
              count: filtered.length,
              rawCount: result.results.length,
              pageTitle: result.pageTitle,
              searchTime,
            },
          };
        } catch (error) {
          const errorTime = Date.now() - parallelSearchStartTime;
          console.error(`❌ [TIMING] ${engine} search failed after ${errorTime}ms:`, error);
          return {
            engine,
            error: String(error),
            success: false,
            searchTime: 0,
          };
        }
      });

      // Wait for all searches to complete
      const searchResults = await Promise.allSettled(searchPromises);
      const parallelTime = Date.now() - parallelSearchStartTime;

      console.log(`⚡ [TIMING] Parallel search completed in ${parallelTime}ms`);

      // Process results
      const processingStartTime = Date.now();
      console.log(`⚡ [TIMING] Starting result processing at ${processingStartTime}ms`);

      for (const settlementResult of searchResults) {
        if (settlementResult.status === 'fulfilled') {
          const searchResult = settlementResult.value;

          if (searchResult.success && 'results' in searchResult && searchResult.results && searchResult.metadata) {
            allResults.push(...searchResult.results);
            engineResults[searchResult.engine] = {
              ...searchResult.metadata,
              success: true,
            };
            console.log(
              `📊 ${searchResult.engine}: Found ${searchResult.metadata.count} results (${searchResult.metadata.rawCount} raw)`,
            );
          } else {
            engineResults[searchResult.engine] = {
              error: searchResult.error,
              success: false,
              searchTime: searchResult.searchTime || 0,
              count: 0,
              rawCount: 0,
            };
          }
        } else {
          console.error(`Promise rejected:`, settlementResult.reason);
        }
      }
    } finally {
      const cleanupStartTime = Date.now();
      console.log(`🧹 [TIMING] Starting page cleanup at ${cleanupStartTime}ms`);

      // Clean up additional pages
      for (const additionalPage of additionalPages) {
        try {
          if (!additionalPage.isClosed()) {
            await additionalPage.close();
          }
        } catch (error) {
          console.warn(`Failed to close additional page:`, error);
        }
      }

      const cleanupTime = Date.now() - cleanupStartTime;
      console.log(`🧹 [TIMING] Page cleanup completed in ${cleanupTime}ms`);
    }

    return { results: allResults, engineResults };
  }

  /**
   * Search across multiple engines with graceful degradation
   */
  async searchMultipleEngines(
    page: Page,
    query: string,
    limit: number,
  ): Promise<{
    query: string;
    results: Array<RawSearchLink & { source: SearchEngine }>;
    debug: Record<string, any>;
  }> {
    const searchStartTime = Date.now();
    console.log(`🔍 [TIMING] MultiEngineSearchHandler starting at ${searchStartTime}ms`);

    let allResults: Array<RawSearchLink & { source: SearchEngine }> = [];
    const engineResults: Record<string, any> = {};

    // Tiered search strategy: Fast engines first, Startpage only if needed
    const primaryEngines: SearchEngine[] = ['duckduckgo', 'bing'];
    const fallbackEngines: SearchEngine[] = ['startpage'];

    console.log(`🎯 [STRATEGY] Starting with fast engines: ${primaryEngines.join(', ')}`);

    try {
      // Tier 1: Run fast engines in parallel
      const primaryResults = await this.runEnginesInParallel(page, primaryEngines, query, limit);
      allResults.push(...primaryResults.results);
      Object.assign(engineResults, primaryResults.engineResults);

      // Check if we have enough results from fast engines
      const uniqueResultsCount = new Set(allResults.map((r) => r.url.toLowerCase())).size;
      const targetThreshold = Math.max(5, Math.ceil(limit * 0.7)); // At least 5 results or 70% of requested

      console.log(
        `📊 [STRATEGY] Fast engines returned ${uniqueResultsCount} unique results (threshold: ${targetThreshold})`,
      );

      // Tier 2: Only run Startpage if we need more results
      if (uniqueResultsCount < targetThreshold) {
        console.log(`🔄 [STRATEGY] Running fallback engines: ${fallbackEngines.join(', ')} (insufficient results)`);
        const fallbackResults = await this.runEnginesInParallel(page, fallbackEngines, query, limit);
        allResults.push(...fallbackResults.results);
        Object.assign(engineResults, fallbackResults.engineResults);
      } else {
        console.log(`✅ [STRATEGY] Skipping Startpage - fast engines provided sufficient results`);
        // Mark Startpage as skipped in debug info
        engineResults.startpage = {
          success: true,
          skipped: true,
          reason: 'Sufficient results from fast engines',
          count: 0,
          rawCount: 0,
          searchTime: 0,
        };
      }
    } catch (error) {
      console.error(`❌ [STRATEGY] Tiered search failed:`, error);
      // Fallback to original behavior if strategy fails
      const allEngines: SearchEngine[] = ['duckduckgo', 'startpage', 'bing'];
      const fallbackResults = await this.runEnginesInParallel(page, allEngines, query, limit);
      allResults = fallbackResults.results;
      Object.assign(engineResults, fallbackResults.engineResults);
    }

    console.log(`Total raw results collected: ${allResults.length}`);

    // Deduplicate by URL
    const deduplicationStartTime = Date.now();
    console.log(`🔄 [TIMING] Starting deduplication at ${deduplicationStartTime}ms`);

    const uniqueResults = new Map<string, RawSearchLink & { source: SearchEngine }>();

    for (const result of allResults) {
      try {
        const urlObj = new URL(result.url);
        const normalizedUrl = `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`.toLowerCase();

        if (!uniqueResults.has(normalizedUrl)) {
          uniqueResults.set(normalizedUrl, result);
        }
      } catch {
        // Use original URL as key if parsing fails
        if (!uniqueResults.has(result.url)) {
          uniqueResults.set(result.url, result);
        }
      }
    }

    const deduplicationTime = Date.now() - deduplicationStartTime;
    console.log(`🔄 [TIMING] Deduplication completed in ${deduplicationTime}ms - ${uniqueResults.size} unique results`);

    // Apply scoring and sort
    const scoringStartTime = Date.now();
    console.log(`🎯 [TIMING] Starting scoring and sorting at ${scoringStartTime}ms`);

    const scoredResults = Array.from(uniqueResults.values())
      .map((result) => ({
        ...result,
        score: this.calculateScore(result, query),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return 0; // Maintain original order for same scores
      })
      .slice(0, limit);

    const scoringTime = Date.now() - scoringStartTime;
    console.log(`🎯 [TIMING] Scoring and sorting completed in ${scoringTime}ms`);

    // Use scored order but omit the score field for response schema
    const finalResults = scoredResults.map(({ score: _score, ...rest }) => rest);

    const totalTime = Date.now() - searchStartTime;
    console.log(`🚀 [TIMING] searchMultipleEngines completed in ${totalTime}ms total`);

    return {
      query,
      results: finalResults,
      debug: {
        engines: engineResults,
        totalEngines: primaryEngines.length + fallbackEngines.length,
        successfulEngines: Object.keys(engineResults).filter((e) => !engineResults[e].error).length,
        deduplicationStats: {
          rawResults: allResults.length,
          uniqueResults: uniqueResults.size,
          finalResults: finalResults.length,
        },
      },
    };
  }
}

/* -------------------------------------------------------------------------- */
/*  Exported handler that integrates with our Durable Object environment      */
/* -------------------------------------------------------------------------- */
export interface SearchSuccess {
  success: true;
  data: {
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      source: SearchEngine;
    }>;
    metadata: {
      query: string;
      totalResults: number;
      searchTime: number;
      sources: string[];
      timestamp: string;
      debug?: Record<string, any>;
    };
  };
  creditsCost: number;
}

export interface SearchFailure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

export type SearchResult = SearchSuccess | SearchFailure;

const CREDIT_COST = 1;

/**
 * Multi-engine browser-powered search using headless Chromium.
 * Tries DuckDuckGo, Startpage, and Bing with graceful degradation.
 */
export async function searchV2(env: CloudflareBindings, params: SearchParams): Promise<SearchResult> {
  const overallStartTime = Date.now();
  console.log(`🔍 [TIMING] searchV2 started at ${overallStartTime}ms`);

  try {
    const browserStartTime = Date.now();
    console.log(`🔍 [TIMING] Calling runWithBrowser at ${browserStartTime}ms`);

    const result = await runWithBrowser(env, async (page) => {
      const handlerStartTime = Date.now();
      console.log(
        `🔍 [TIMING] Browser acquired, starting MultiEngineSearchHandler at ${handlerStartTime}ms (browser acquisition took ${
          handlerStartTime - browserStartTime
        }ms)`,
      );

      const handler = new MultiEngineSearchHandler();
      const searchResult = await handler.searchMultipleEngines(page, params.query, params.limit ?? 10);

      const handlerEndTime = Date.now();
      console.log(
        `🔍 [TIMING] MultiEngineSearchHandler completed at ${handlerEndTime}ms (search execution took ${
          handlerEndTime - handlerStartTime
        }ms)`,
      );

      return searchResult;
    });

    const browserEndTime = Date.now();
    console.log(
      `🔍 [TIMING] runWithBrowser completed at ${browserEndTime}ms (total browser time: ${
        browserEndTime - browserStartTime
      }ms)`,
    );

    const elapsed = Date.now() - overallStartTime;
    const sources = [...new Set(result.results.map((r) => r.source))];

    console.log(`🔍 [TIMING] searchV2 completed in ${elapsed}ms total`);

    return {
      success: true,
      data: {
        results: result.results,
        metadata: {
          query: params.query,
          totalResults: result.results.length,
          searchTime: elapsed,
          sources,
          timestamp: new Date().toISOString(),
        },
      },
      creditsCost: CREDIT_COST,
    };
  } catch (err) {
    const errorTime = Date.now() - overallStartTime;
    console.error(`🔍 [TIMING] searchV2 failed after ${errorTime}ms:`, err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
