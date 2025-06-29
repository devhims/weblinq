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
  protected abstract getSearchUrl(query: string): string;
  protected abstract getSelectors(): string[];
  protected abstract getSnippetSelectors(): string[];
  protected abstract extractResults(page: Page, selector: string): Promise<RawSearchLink[]>;
  public abstract cleanUrl(url: string): string;
  protected abstract isBlocked(pageTitle: string, html?: string): boolean;

  /**
   * Common search flow for all engines
   */
  async performSearch(page: Page, query: string): Promise<InternalSearchResult> {
    const url = this.getSearchUrl(query);
    console.log(`SearchHandler: 🌐 Navigating to ${url}`);

    // Enable request interception to block CSS/fonts/images for faster loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10_000 });
    console.log('SearchHandler: ✅ Page loaded successfully');

    // Give page extra time if results haven't loaded yet
    const selectors = this.getSelectors();
    const hasContent = await page
      .waitForSelector(selectors.join(', '), { timeout: 1500 })
      .then(() => true)
      .catch(() => false);

    if (!hasContent) {
      await new Promise((res) => setTimeout(res, 400));
    }

    let results: RawSearchLink[] = [];
    let usedSelector = '';

    for (const selector of selectors) {
      try {
        const selectorResults = await this.extractResults(page, selector);
        if (selectorResults.length > 0) {
          results = selectorResults;
          usedSelector = selector;
          console.log(`SearchHandler: 🎯 Found ${selectorResults.length} results using: ${selector}`);
          break;
        }
      } catch {
        continue;
      }
    }

    // Check for blocking
    const pageTitle = await page.title();
    const html = await page.content();
    const isBlocked = this.isBlocked(pageTitle, html);

    if (isBlocked) {
      throw new Error('Page blocked or CAPTCHA detected');
    }

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
  protected getSearchUrl(query: string): string {
    return `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
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
  protected getSearchUrl(query: string): string {
    return `https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}&cat=web&pl=opensearch`;
  }

  protected getSelectors(): string[] {
    return ['.w-gl__result', '.result-item', '.search-result', '[data-testid="result"]', '.result'];
  }

  protected getSnippetSelectors(): string[] {
    return ['.w-gl__description', '.result-snippet', '.search-item-snippet', '.result-description'];
  }

  protected async extractResults(page: Page, selector: string): Promise<RawSearchLink[]> {
    return page.$$eval(selector, (elements) => {
      return (elements as any[])
        .map((element: any) => {
          let title = '';
          let url = '';
          let snippet = '';

          // Find URL first
          const urlSelectors = ['a[href^="https://"]', 'a[href^="http://"]'];
          for (const urlSel of urlSelectors) {
            const linkEl = element.querySelector(urlSel);
            if (linkEl?.href && linkEl.href.startsWith('http')) {
              url = linkEl.href;
              break;
            }
          }

          if (!url) return null;

          // Find title
          const titleSelectors = [
            'h3',
            '.title',
            '.result-title',
            'h3 a:not(:has(img))',
            '.result-title a:not(:has(img))',
            'a:not(:has(img))',
            'a[href^="https://"]:not(:has(img))',
          ];

          for (const titleSel of titleSelectors) {
            const titleEl = element.querySelector(titleSel);
            if (titleEl?.textContent?.trim()) {
              const titleText = titleEl.textContent.trim();

              // Basic cleaning
              if (titleText.length > 5 && !titleText.includes('css-')) {
                title = titleText;
                break;
              }
            }
          }

          // Fallback title from URL
          if (!title) {
            try {
              const urlObj = new URL(url);
              title = urlObj.hostname.replace('www.', '');
            } catch {
              title = 'Search Result';
            }
          }

          // Find snippet
          const snippetSelectors = [
            '.w-gl__description',
            '.result-snippet',
            '.search-item-snippet',
            '.result-description',
            '.description',
            '.snippet',
            'p',
          ];

          for (const snippetSel of snippetSelectors) {
            const snippetEl = element.querySelector(snippetSel);
            if (snippetEl?.textContent?.trim() && snippetEl.textContent.trim().length > 10) {
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
    return url; // Startpage typically provides clean URLs
  }

  protected isBlocked(pageTitle: string): boolean {
    const title = pageTitle.toLowerCase();
    return title.includes('verification') || title.includes('captcha') || title.includes('blocked');
  }
}

class BingHandler extends BaseSearchHandler {
  protected getSearchUrl(query: string): string {
    return `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
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
    if (!url.includes('bing.com')) {
      return url;
    }

    // Handle Bing redirect patterns
    if (url.includes('/ck/a?')) {
      const patterns = [/[&?]u=([^&]+)/, /[&?]url=([^&]+)/, /[&?]p=([^&]+)/];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          try {
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

          return decoded.startsWith('http') ? decoded : url;
        } catch {
          return url;
        }
      }
    } else if (url.includes('target=')) {
      const match = url.match(/[&?]target=([^&]+)/);
      if (match) {
        try {
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

          return decoded.startsWith('http') ? decoded : url;
        } catch {
          return url;
        }
      }
    }

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
    // Tokenize query into words (improved word boundary detection)
    // Allow important 2-character terms like "AI", "UK", "JS", "Go"
    const importantShortTerms = new Set(['ai', 'uk', 'js', 'go', 'ui', 'ux', 'vr', 'ar', 'ml', 'dl', 'it', 'io']);
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2 || importantShortTerms.has(word));

    if (queryWords.length === 0) return 0;

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
    const rawRecencyBonus = this.calculateRecencyBonus(result);
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
    return Math.max(0, Math.min(score, W.maxTotalScore));
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
    const engines: SearchEngine[] = ['duckduckgo', 'startpage', 'bing'];
    const allResults: Array<RawSearchLink & { source: SearchEngine }> = [];
    const engineResults: Record<string, any> = {};

    console.log(`🚀 Starting parallel search across ${engines.length} engines...`);
    const parallelStartTime = Date.now();

    // Create multiple pages for parallel processing
    const browser = page.browser();
    const additionalPages: Page[] = [];

    try {
      // Create additional pages for parallel processing (we already have one page)
      for (let i = 1; i < engines.length; i++) {
        const newPage = await browser.newPage();
        // Apply same hardening as the original page
        await hardenPageAdvanced(newPage);
        additionalPages.push(newPage);
      }

      const pages = [page, ...additionalPages];

      // Execute searches in parallel using Promise.allSettled for graceful error handling
      const searchPromises = engines.map(async (engine, index) => {
        const enginePage = pages[index];
        const handler = this.handlers.get(engine);

        if (!handler) {
          console.warn(`No handler found for engine: ${engine}`);
          return { engine, error: 'No handler found', success: false };
        }

        try {
          console.log(`🔍 Starting ${engine} search on page ${index + 1}...`);
          const startTime = Date.now();
          const result = await handler.performSearch(enginePage, query);
          const searchTime = Date.now() - startTime;

          console.log(`✅ ${engine} completed in ${searchTime}ms, found ${result.results.length} raw results`);

          // Filter and clean results
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
            }))
            .slice(0, limit);

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
          console.error(`❌ ${engine} search failed:`, error);
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
      const parallelTime = Date.now() - parallelStartTime;

      console.log(`⚡ Parallel search completed in ${parallelTime}ms`);

      // Process results
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
    }

    console.log(`Total raw results collected: ${allResults.length}`);

    // Deduplicate by URL
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

    console.log(`Unique results after deduplication: ${uniqueResults.size}`);

    // Apply scoring and sort
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

    // Use scored order but omit the score field for response schema
    const finalResults = scoredResults.map(({ score: _score, ...rest }) => rest);

    return {
      query,
      results: finalResults,
      debug: {
        engines: engineResults,
        totalEngines: engines.length,
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
  const startTime = Date.now();
  try {
    const result = await runWithBrowser(env, async (page) => {
      const handler = new MultiEngineSearchHandler();
      return handler.searchMultipleEngines(page, params.query, params.limit ?? 10);
    });

    const elapsed = Date.now() - startTime;
    const sources = [...new Set(result.results.map((r) => r.source))];

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
    console.error('searchV2 error', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
