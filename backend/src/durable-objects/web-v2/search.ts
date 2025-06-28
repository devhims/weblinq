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
  private calculateScore(result: RawSearchLink, query: string): number {
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 2);

    if (queryWords.length === 0) return 0;

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
    let titleMatches = 0;
    let snippetMatches = 0;
    let urlMatches = 0;
    const titleMatchedWords = new Set<string>();
    const snippetMatchedWords = new Set<string>();
    const urlMatchedWords = new Set<string>();

    // Calculate matches for each query word
    for (const word of queryWords) {
      let titleMatchFound = false;
      let snippetMatchFound = false;
      let urlMatchFound = false;

      // Title matches with enhanced scoring
      if (titleLower.includes(word)) {
        titleMatchFound = true;
        titleMatches++;
        titleMatchedWords.add(word);

        // Word boundary bonus (more precise matches)
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(result.title)) {
          score += 12; // Base score for precise title match
        } else {
          score += 8; // Partial title match
        }
      }

      // Snippet matches with improved weighting
      if (snippetLower.includes(word)) {
        snippetMatchFound = true;
        snippetMatches++;
        snippetMatchedWords.add(word);

        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(result.snippet || '')) {
          score += 6; // Precise snippet match
        } else {
          score += 4; // Partial snippet match
        }
      }

      // 🌐 URL/DOMAIN MATCHES: Critical for brand searches
      if (urlHost.includes(word) || urlPath.includes(word)) {
        urlMatchFound = true;
        urlMatches++;
        urlMatchedWords.add(word);

        // 🎯 EXACT DOMAIN MATCH: Massive bonus for brand searches
        if (urlHost === word || urlHost === `${word}.com` || urlHost === `${word}.org` || urlHost === `${word}.net`) {
          score += 25; // Huge bonus for exact domain match (e.g., devhims.com for "devhims")
        } else if (urlHost.startsWith(word) || urlHost.endsWith(word)) {
          score += 15; // Strong bonus for domain prefix/suffix match
        } else if (urlHost.includes(word)) {
          score += 10; // Good bonus for domain substring match
        } else if (urlPath.includes(word)) {
          score += 8; // Bonus for path match
        }
      }

      // 🎯 SYNERGY BONUSES: Extra points for multi-area matches
      const matchAreas = [titleMatchFound, snippetMatchFound, urlMatchFound].filter(Boolean).length;
      if (matchAreas >= 2) {
        score += matchAreas * 6; // Bonus scales with number of areas matched
      }
    }

    // 🚀 COMPREHENSIVE MATCH BONUS: When multiple areas have matches
    const totalMatches = titleMatches + snippetMatches + urlMatches;
    if (totalMatches > 0) {
      const matchCoverage = totalMatches / (queryWords.length * 3); // 3 areas: title, snippet, URL
      score += Math.floor(matchCoverage * 20); // Scale bonus based on coverage

      // Extra bonus for high coverage across all areas
      if (titleMatches > 0 && snippetMatches > 0 && urlMatches > 0) {
        score += 15; // All three areas have matches
      } else if ((titleMatches > 0 && urlMatches > 0) || (snippetMatches > 0 && urlMatches > 0)) {
        score += 10; // Two areas including URL
      } else if (titleMatches > 0 && snippetMatches > 0) {
        score += 8; // Title and snippet both match
      }
    }

    // 📈 DIVERSITY BONUS: Reward when different query words match across areas
    const uniqueWords = new Set([...titleMatchedWords, ...snippetMatchedWords, ...urlMatchedWords]);
    if (uniqueWords.size > 1) {
      score += (uniqueWords.size - 1) * 4; // Increased bonus for keyword diversity
    }

    // 🏆 AUTHORITY SIGNALS: Domain quality indicators
    if (urlHost.split('.').length === 2 && !urlHost.includes('-') && !urlHost.includes('_')) {
      score += 3; // Clean, short domain bonus
    }

    // 📏 QUALITY ADJUSTMENTS
    // Penalty for very long titles (often less relevant)
    if (result.title.length > 100) {
      score -= 3;
    }

    // Bonus for substantial snippets (more informative)
    if (result.snippet && result.snippet.length > 50 && result.snippet.length < 300) {
      score += 2;
    }

    // Small penalty for very short snippets (less informative)
    if (result.snippet && result.snippet.length < 20) {
      score -= 1;
    }

    return Math.max(0, score); // Ensure non-negative scores
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
