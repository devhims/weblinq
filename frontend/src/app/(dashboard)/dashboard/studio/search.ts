'use server';

import { headers } from 'next/headers';
import * as cheerio from 'cheerio';
import { z } from 'zod';

// Types and validation schemas
// Current search engine status:
// ✅ Startpage - Working well with clean title extraction
// ✅ Bing - Working with enhanced URL cleaning for redirects
// ❌ DuckDuckGo - Blocked by bot detection (tries but fails fast)
// ⚠️ Yandex - Available but not used in main search
// ❌ Brave - Removed due to API rate limits/costs
const SearchResultSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  snippet: z.string(),
  source: z.enum(['duckduckgo', 'startpage', 'yandex', 'bing']), // 'brave' removed due to rate limits
});

const SearchParamsSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(50).optional().default(10),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchParams = z.infer<typeof SearchParamsSchema>;

interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  sources: string[];
}

// Rate limiting and caching helpers
const rateLimiter = new Map<string, { count: number; resetTime: number }>();

// Helper functions for URL and metadata processing
function generateTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace('www.', '');
    let title = domain.charAt(0).toUpperCase() + domain.slice(1);

    // Add path context if available
    const pathParts = urlObj.pathname.split('/').filter((p) => p.length > 0);
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && lastPart !== 'index.html') {
        title +=
          ' - ' +
          lastPart.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      }
    }
    return title;
  } catch (e) {
    return 'Search Result';
  }
}

function generateSnippetFromUrl(url: string, title: string): string {
  return `Search result from ${title.toLowerCase().replace(' - ', ' about ')}`;
}

// Clean title text by removing CSS, styles, and unwanted content
function cleanTitleText(text: string): string {
  if (!text) return '';

  // Remove CSS rules and styles
  text = text.replace(/\.css-[^}]*}/g, '');
  text = text.replace(/\{[^}]*\}/g, '');
  text = text.replace(/@media[^}]*}/g, '');

  // Remove common CSS patterns and fragments
  text = text.replace(/\.css-\w+/g, '');
  text = text.replace(/style\s*=\s*["'][^"']*["']/g, '');
  text = text.replace(/media\s*\([^)]*\)/g, ''); // Remove media queries
  text = text.replace(/max-width:\s*\d+px/g, ''); // Remove max-width
  text = text.replace(/min-width:\s*\d+px/g, ''); // Remove min-width
  text = text.replace(/\d+px/g, ''); // Remove pixel values
  text = text.replace(/#[0-9A-F]{6}/gi, ''); // Remove hex colors

  // Extract meaningful text after CSS cleanup
  const parts = text
    .split(/[{}@();,]/)
    .filter(
      (part) =>
        part.trim().length > 5 &&
        !part.includes('css-') &&
        !part.includes('margin') &&
        !part.includes('padding') &&
        !part.includes('font-size') &&
        !part.includes('line-height') &&
        !part.includes('font-weight') &&
        !part.includes('color:') &&
        !part.includes('display:') &&
        !part.includes('webkit') &&
        !part.match(/^\d+px/) &&
        !part.match(/^(media|max-width|min-width)/) &&
        !part.match(/^#[0-9A-F]{6}/i)
    );

  // Return the longest meaningful part, or first part if all are short
  const meaningfulPart =
    parts.length > 0
      ? parts.reduce((longest, current) =>
          current.length > longest.length ? current : longest
        )
      : text;

  return meaningfulPart.trim();
}

// Removed fetchPageMetadata function - was causing delays in Startpage search
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userLimit = rateLimiter.get(ip);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimiter.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  userLimit.count++;
  return true;
}

// Enhanced fetch with retries and proper error handling
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 2
): Promise<Response> {
  // Rotate User-Agents to avoid detection
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0',
  ];

  const defaultHeaders = {
    'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
  };

  const fetchOptions: RequestInit = {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to fetch ${url} after ${maxRetries + 1} attempts: ${error}`
        );
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }

  throw new Error('Unexpected error in fetchWithRetry');
}

// DuckDuckGo rate limiting tracker
const duckDuckGoLastRequest = { time: 0 };
const DUCKDUCKGO_MIN_DELAY = 1000; // 1 second (faster failure since it's being blocked anyway)

// DuckDuckGo search implementation
async function searchDuckDuckGo(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    // Add delay to prevent DuckDuckGo rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - duckDuckGoLastRequest.time;
    if (timeSinceLastRequest < DUCKDUCKGO_MIN_DELAY) {
      const delayNeeded = DUCKDUCKGO_MIN_DELAY - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delayNeeded));
    }
    duckDuckGoLastRequest.time = Date.now();

    // Try DuckDuckGo Lite which is more bot-friendly
    const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;

    // Enhanced headers specifically for DuckDuckGo
    const enhancedHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      DNT: '1',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0',
      Referer: 'https://duckduckgo.com/',
    };

    const response = await fetchWithRetry(
      searchUrl,
      { headers: enhancedHeaders },
      1
    ); // Reduced retries since DDG is blocking us
    const html = await response.text();

    // Check for bot detection/blocking indicators
    if (
      html.includes('rate limit') ||
      html.includes('too many requests') ||
      html.includes('blocked') ||
      html.includes('<title>DuckDuckGo</title>') || // Homepage redirect = blocked
      html.includes('rel="canonical" href="https://duckduckgo.com/"') || // Homepage = blocked
      html.length < 1000
    ) {
      console.warn(
        'DuckDuckGo: Bot detection/blocking detected (HTML length:',
        html.length + ')'
      );
      throw new Error('DuckDuckGo is blocking automated requests');
    }

    const $ = cheerio.load(html);

    const results: SearchResult[] = [];

    // Debug: Check what selectors are available (lite version has different structure)
    const debugSelectors = [
      '.result__body', // Original
      '.result', // Alternative
      'table tr', // Lite version uses tables
      '.web-result',
      '.results_links',
      '.result--web',
      'td', // Lite version content
    ];
    let foundElements = 0;
    for (const sel of debugSelectors) {
      const count = $(sel).length;
      if (count > 0) {
        console.log(`DuckDuckGo selector "${sel}": ${count} elements`);
        foundElements += count;
      }
    }

    if (foundElements === 0) {
      console.log(
        'DuckDuckGo: No result elements found. HTML sample:',
        html.substring(0, 500)
      );
      return results; // Return empty if no results found
    }

    // Try multiple selectors based on what's available (including lite version)
    const selectorsToTry = [
      '.result__body', // Original HTML version
      '.result', // Alternative
      'table tr', // Lite version uses simple table rows
      '.web-result',
      '.results_links',
    ];

    for (const selector of selectorsToTry) {
      if (results.length >= limit) break;

      const elements = $(selector);
      if (elements.length === 0) continue;

      console.log(`DuckDuckGo: Processing with selector "${selector}"`);

      elements.each((i, element) => {
        if (results.length >= limit) return false;

        const $element = $(element);

        // Try multiple title/link patterns (including lite version)
        const titleSelectors = [
          '.result__title a', // Original
          '.result__a', // Alternative
          'h3 a', // Standard
          'h2 a', // Alternative
          '.title a', // Generic
          'a[href*="http"]', // Any external link
          'a[href^="/l/?"]', // DuckDuckGo redirect links
          'td a', // Lite version links in table cells
        ];

        const snippetSelectors = [
          '.result__snippet', // Original
          '.snippet', // Alternative
          '.description', // Generic
          'p', // Paragraph text
          '.abstract', // Abstract text
          'td:not(:has(a))', // Lite version text cells (without links)
          'td', // Any table cell
        ];

        let title = '',
          url = '',
          snippet = '';

        // Find title and URL
        for (const titleSel of titleSelectors) {
          const titleEl = $element.find(titleSel);
          if (titleEl.length > 0) {
            title = titleEl.text().trim();
            url = titleEl.attr('href') || '';
            if (title && url) break;
          }
        }

        // Find snippet
        for (const snippetSel of snippetSelectors) {
          const snippetEl = $element.find(snippetSel);
          if (snippetEl.length > 0) {
            snippet = snippetEl.text().trim();
            if (snippet) break;
          }
        }

        if (title && url && snippet) {
          try {
            let cleanUrl = url;

            // Handle various DuckDuckGo URL patterns
            if (url.startsWith('/l/?uddg=')) {
              cleanUrl = decodeURIComponent(url.split('uddg=')[1]);
            } else if (url.startsWith('/l/?kh=-1&uddg=')) {
              cleanUrl = decodeURIComponent(url.split('uddg=')[1]);
            } else if (url.includes('uddg=')) {
              const match = url.match(/uddg=([^&]+)/);
              if (match) {
                cleanUrl = decodeURIComponent(match[1]);
              }
            }

            // Ensure we have a valid URL
            if (!cleanUrl.startsWith('http')) {
              cleanUrl = url;
            }

            results.push({
              title,
              url: cleanUrl,
              snippet,
              source: 'duckduckgo',
            });
          } catch (e) {
            console.error('Error processing DuckDuckGo URL:', e);
          }
        }
      });

      if (results.length > 0) break; // Stop trying other selectors if we got results
    }

    console.log(`DuckDuckGo found ${results.length} results`);

    // If lite version failed, try fallback to main search as last resort
    if (results.length === 0 && searchUrl.includes('lite.duckduckgo.com')) {
      console.log('DuckDuckGo: Lite version failed, trying main search...');
      try {
        const fallbackUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web`;
        const fallbackResponse = await fetchWithRetry(
          fallbackUrl,
          { headers: enhancedHeaders },
          2
        );
        const fallbackHtml = await fallbackResponse.text();

        if (fallbackHtml.length > 2000) {
          // More substantial content
          console.log(
            'DuckDuckGo: Fallback returned content, but parsing not implemented for main site'
          );
        }
      } catch (fallbackError) {
        console.log('DuckDuckGo: Fallback also failed');
      }
    }

    return results;
  } catch (error) {
    console.error('DuckDuckGo search failed:', error);
    return [];
  }
}

// Startpage search implementation
async function searchStartpage(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}&cat=web&pl=opensearch`;
    const response = await fetchWithRetry(searchUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const results: SearchResult[] = [];

    // Try multiple selectors as Startpage may have changed their HTML structure
    const resultSelectors = [
      '.w-gl__result',
      '.result-item',
      '.search-result',
      '[data-testid="result"]',
      '.result', // Keep this but handle differently
    ];

    let elementsFound = false;

    for (const selector of resultSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elementsFound = true;
        console.log(
          `Startpage: Using selector "${selector}", found ${elements.length} elements`
        );

        // Extract titles and snippets directly from Startpage HTML (no additional HTTP requests)
        if (selector === '.result') {
          elements.each((i, element) => {
            if (results.length >= limit) return false;

            const $element = $(element);

            // Debug logging for first few results (reduced)
            if (results.length < 2) {
              console.log(
                `Startpage result ${results.length} HTML sample:`,
                $element.html()?.substring(0, 200) + '...'
              );
            }

            // Try to extract title and URL from various Startpage link patterns
            let title = '',
              url = '',
              snippet = '';

            // Step 1: Find the URL first from any valid link
            const urlSelectors = ['a[href^="https://"]', 'a[href^="http://"]'];

            for (const urlSel of urlSelectors) {
              const linkEl = $element.find(urlSel).first();
              if (linkEl.length > 0) {
                const linkUrl = linkEl.attr('href');
                if (linkUrl && linkUrl.startsWith('http')) {
                  url = linkUrl;
                  break;
                }
              }
            }

            // Step 2: Find the title separately (prioritize text-only links)
            if (url) {
              const titleSelectors = [
                'h3', // Plain h3 text
                '.title', // Title class
                '.result-title', // Result title class
                'h3 a:not(:has(img))', // h3 links without images
                '.result-title a:not(:has(img))', // Title links without images
                'a:not(:has(img))', // Any link without images
                'a[href^="https://"]:not(:has(img))', // HTTPS links without images
              ];

              for (const titleSel of titleSelectors) {
                const titleEl = $element.find(titleSel).first();
                if (titleEl.length > 0) {
                  let titleText = titleEl.text().trim();

                  // Clean CSS and unwanted content from title
                  titleText = cleanTitleText(titleText);

                  if (results.length < 2) {
                    console.log(
                      `Startpage "${titleSel}": "${titleText.substring(0, 80)}"`
                    );
                  }

                  // Use title if it's meaningful and clean
                  if (
                    titleText &&
                    titleText.length > 5 &&
                    !titleText.includes('css-')
                  ) {
                    title = titleText;
                    break;
                  }
                }
              }

              // Fallback to URL-based title if we couldn't find good title text
              if (!title || title.length === 0) {
                title = generateTitleFromUrl(url);
              }
            }

            // Look for snippet/description text
            if (url) {
              const snippetSelectors = [
                '.result-snippet',
                '.description',
                '.snippet',
                'p',
                '.result-description',
              ];

              for (const snippetSel of snippetSelectors) {
                const snippetEl = $element.find(snippetSel).first();
                if (snippetEl.length > 0) {
                  const snippetText = snippetEl.text().trim();
                  if (snippetText && snippetText.length > 10) {
                    snippet = snippetText;
                    break;
                  }
                }
              }

              // Fallback to URL-based snippet if none found
              if (!snippet) {
                snippet = generateSnippetFromUrl(url, title);
              }

              if (title && url && snippet) {
                // Debug logging for final result (reduced)
                if (results.length < 1) {
                  console.log(`Startpage sample: "${title.substring(0, 60)}"`);
                }

                results.push({
                  title,
                  url,
                  snippet,
                  source: 'startpage',
                });
              }
            }
          });
        } else {
          // Original logic for other selectors
          elements.each((i, element) => {
            if (results.length >= limit) return false;

            const $element = $(element);

            // Try multiple title selectors
            const titleSelectors = [
              '.w-gl__result-title a',
              '.result-title a',
              '.search-item-title a',
              'h3 a',
              'a[data-testid="result-title-a"]',
            ];

            // Try multiple snippet selectors
            const snippetSelectors = [
              '.w-gl__description',
              '.result-snippet',
              '.search-item-snippet',
              '.result-description',
            ];

            let title = '',
              url = '',
              snippet = '';

            // Find title and URL
            for (const titleSel of titleSelectors) {
              const titleEl = $element.find(titleSel);
              if (titleEl.length > 0) {
                title = titleEl.text().trim();
                url = titleEl.attr('href') || '';
                break;
              }
            }

            // Find snippet
            for (const snippetSel of snippetSelectors) {
              const snippetEl = $element.find(snippetSel);
              if (snippetEl.length > 0) {
                snippet = snippetEl.text().trim();
                break;
              }
            }

            if (title && url && snippet) {
              try {
                results.push({
                  title,
                  url,
                  snippet,
                  source: 'startpage',
                });
              } catch (e) {
                console.error('Error processing Startpage result:', e);
              }
            }
          });
        }
        break; // Stop trying other selectors if we found results
      }
    }

    if (!elementsFound) {
      console.warn('Startpage: No result elements found with any selector');
      // Log a sample of the HTML to debug
      console.log('Startpage HTML sample:', html.substring(0, 1000));
    }

    console.log(`Startpage found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Startpage search failed:', error);
    return [];
  }
}

// Yandex search implementation
async function searchYandex(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://yandex.com/search/?text=${encodeURIComponent(query)}&lr=84`;
    const response = await fetchWithRetry(searchUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const results: SearchResult[] = [];

    // Try multiple selectors as Yandex may have changed their HTML structure
    const resultSelectors = [
      '.serp-item',
      '.serp-item_type_search',
      '.MMOrganicSnippet',
      '.organic',
      '[data-cid]',
    ];

    let elementsFound = false;

    for (const selector of resultSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elementsFound = true;
        console.log(
          `Yandex: Using selector "${selector}", found ${elements.length} elements`
        );

        elements.each((i, element) => {
          if (results.length >= limit) return false;

          const $element = $(element);

          // Try multiple title selectors
          const titleSelectors = [
            '.organic__title-wrapper a',
            '.MMOrganicSnippet-Title a',
            '.organic__url a',
            'h3 a',
            '.VanillaReact a[data-cid]',
          ];

          // Try multiple snippet selectors
          const snippetSelectors = [
            '.organic__text',
            '.MMOrganicSnippet-Text',
            '.organic__content-wrapper .organic__text',
            '.VanillaReact .organic__text',
          ];

          let title = '',
            url = '',
            snippet = '';

          // Find title and URL
          for (const titleSel of titleSelectors) {
            const titleEl = $element.find(titleSel);
            if (titleEl.length > 0) {
              title = titleEl.text().trim();
              url = titleEl.attr('href') || '';
              break;
            }
          }

          // Find snippet
          for (const snippetSel of snippetSelectors) {
            const snippetEl = $element.find(snippetSel);
            if (snippetEl.length > 0) {
              snippet = snippetEl.text().trim();
              break;
            }
          }

          if (title && url && snippet) {
            try {
              // Clean Yandex URLs if needed
              let cleanUrl = url;
              if (url.startsWith('/url?')) {
                // Handle Yandex redirect URLs
                const urlMatch = url.match(/url=([^&]+)/);
                if (urlMatch) {
                  cleanUrl = decodeURIComponent(urlMatch[1]);
                }
              }

              results.push({
                title,
                url: cleanUrl,
                snippet,
                source: 'yandex',
              });
            } catch (e) {
              console.error('Error processing Yandex result:', e);
            }
          }
        });
        break; // Stop trying other selectors if we found results
      }
    }

    if (!elementsFound) {
      console.warn('Yandex: No result elements found with any selector');
      // Log a sample of the HTML to debug
      console.log('Yandex HTML sample:', html.substring(0, 1000));
    }

    console.log(`Yandex found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Yandex search failed:', error);
    return [];
  }
}

// Bing search implementation (fallback)
async function searchBing(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    const response = await fetchWithRetry(searchUrl);
    const html = await response.text();
    const $ = cheerio.load(html);

    const results: SearchResult[] = [];

    // Try multiple selectors for Bing
    const resultSelectors = ['.b_algo', '.b_result', '.b_algoheader'];

    let elementsFound = false;

    for (const selector of resultSelectors) {
      const elements = $(selector);
      if (elements.length > 0) {
        elementsFound = true;
        console.log(
          `Bing: Using selector "${selector}", found ${elements.length} elements`
        );

        elements.each((i, element) => {
          if (results.length >= limit) return false;

          const $element = $(element);

          // Try multiple title selectors
          const titleSelectors = ['h2 a', '.b_algoheader a', '.b_title a'];

          // Try multiple snippet selectors
          const snippetSelectors = [
            '.b_caption p',
            '.b_snippet',
            '.b_descript',
          ];

          let title = '',
            url = '',
            snippet = '';

          // Find title and URL
          for (const titleSel of titleSelectors) {
            const titleEl = $element.find(titleSel);
            if (titleEl.length > 0) {
              title = titleEl.text().trim();
              url = titleEl.attr('href') || '';
              break;
            }
          }

          // Find snippet
          for (const snippetSel of snippetSelectors) {
            const snippetEl = $element.find(snippetSel);
            if (snippetEl.length > 0) {
              snippet = snippetEl.text().trim();
              break;
            }
          }

          if (title && url && snippet && url.startsWith('http')) {
            try {
              // Clean Bing URLs to remove any redirect patterns
              let cleanUrl = url;

              // Debug: log Bing URLs (reduced)
              if (results.length < 1) {
                console.log(
                  `Bing raw URL sample:`,
                  url.substring(0, 80) + '...'
                );
              }

              // Handle various Bing redirect patterns
              if (url.includes('bing.com')) {
                // Pattern 1: bing.com/ck/a?!&&p=...&u=<encoded_url>
                if (url.includes('/ck/a?')) {
                  // Try multiple parameter patterns for ck/a URLs
                  const patterns = [
                    /[&?]u=([^&]+)/, // &u= parameter
                    /[&?]url=([^&]+)/, // &url= parameter
                    /[&?]p=([^&]+)/, // &p= parameter (sometimes contains URL)
                  ];

                  for (const pattern of patterns) {
                    const urlMatch = url.match(pattern);
                    if (urlMatch) {
                      try {
                        let decoded = decodeURIComponent(urlMatch[1]);

                        // Debug logging for pattern matching (reduced)
                        if (results.length < 1) {
                          console.log(`Bing pattern: ${pattern.source}`);
                        }

                        // Check if it's a direct HTTP URL first
                        if (decoded.startsWith('http')) {
                          cleanUrl = decoded;
                          break;
                        }

                        // Handle base64-encoded URLs (common in Bing ck/a URLs)
                        // Bing often encodes URLs as base64 with prefixes like 'a1'
                        if (
                          decoded.length > 10 &&
                          !decoded.startsWith('http')
                        ) {
                          try {
                            // Try different base64 decoding approaches
                            let base64Attempts = [
                              decoded, // Try as-is
                              decoded.substring(2), // Remove first 2 chars (like 'a1')
                              decoded.substring(1), // Remove first char
                            ];

                            for (const attempt of base64Attempts) {
                              try {
                                const base64Decoded = Buffer.from(
                                  attempt,
                                  'base64'
                                ).toString('utf-8');

                                // Check if the decoded result contains a valid URL
                                if (base64Decoded.includes('http')) {
                                  // Extract the URL from the decoded string
                                  const urlMatch = base64Decoded.match(
                                    /(https?:\/\/[^\s<>"]+)/
                                  );
                                  if (urlMatch) {
                                    cleanUrl = urlMatch[1];
                                    break;
                                  }
                                }
                              } catch (base64Error) {
                                // Try next attempt
                                continue;
                              }
                            }

                            if (cleanUrl !== url) break; // Exit outer loop if we found a URL
                          } catch (base64Error) {
                            // Not base64, continue with next pattern
                          }
                        }
                      } catch (e) {
                        // Try next pattern if decoding fails
                        continue;
                      }
                    }
                  }
                }
                // Pattern 2: www.bing.com/cr?IG=...&CID=...&rd=1&h=...&v=1&r=...&p=...
                else if (url.includes('/cr?') && url.includes('&r=')) {
                  const urlMatch = url.match(/[&?]r=([^&]+)/);
                  if (urlMatch) {
                    cleanUrl = decodeURIComponent(urlMatch[1]);
                  }
                }
                // Pattern 3: General pattern with 'target=' parameter
                else if (url.includes('target=')) {
                  const urlMatch = url.match(/[&?]target=([^&]+)/);
                  if (urlMatch) {
                    cleanUrl = decodeURIComponent(urlMatch[1]);
                  }
                }
                // Pattern 4: cc= parameter sometimes contains the URL
                else if (url.includes('&cc=')) {
                  const urlMatch = url.match(/[&?]cc=([^&]+)/);
                  if (urlMatch) {
                    try {
                      const decoded = decodeURIComponent(urlMatch[1]);
                      if (decoded.startsWith('http')) {
                        cleanUrl = decoded;
                      }
                    } catch (e) {
                      // Keep original if decoding fails
                    }
                  }
                }
              }

              // Additional cleaning for base64 or double-encoded URLs
              if (cleanUrl !== url) {
                try {
                  // Try to decode again in case of double encoding
                  const doubleDecoded = decodeURIComponent(cleanUrl);
                  if (
                    doubleDecoded.startsWith('http') &&
                    doubleDecoded !== cleanUrl
                  ) {
                    cleanUrl = doubleDecoded;
                  }
                } catch (e) {
                  // Keep single decoded version
                }
              }

              // Ensure we have a valid URL after cleaning
              if (!cleanUrl.startsWith('http')) {
                console.warn(
                  'Bing URL cleaning failed, keeping original:',
                  url
                );
                cleanUrl = url; // Fall back to original if cleaning failed
              } else if (cleanUrl !== url && results.length < 1) {
                console.log(
                  `Bing URL cleaned: ${cleanUrl.substring(0, 80)}...`
                );
              }

              results.push({
                title,
                url: cleanUrl,
                snippet,
                source: 'bing',
              });
            } catch (e) {
              console.error('Error processing Bing result:', e);
            }
          }
        });
        break;
      }
    }

    if (!elementsFound) {
      console.warn('Bing: No result elements found with any selector');
      console.log('Bing HTML sample:', html.substring(0, 1000));
    }

    console.log(`Bing found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Bing search failed:', error);
    return [];
  }
}

// Brave Search API implementation
async function searchBrave(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    // Note: You'll need to set BRAVE_SEARCH_API_KEY in your environment variables
    const apiKey = process.env.BRAVE_SEARCH_API_KEY;

    if (!apiKey) {
      console.warn('Brave Search API key not found, skipping Brave search');
      return [];
    }

    const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(limit, 20)}`;

    const response = await fetchWithRetry(searchUrl, {
      headers: {
        'X-Subscription-Token': apiKey,
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
    });

    const data = await response.json();
    const results: SearchResult[] = [];

    if (data.web?.results) {
      for (const result of data.web.results.slice(0, limit)) {
        if (result.title && result.url && result.description) {
          // Clean any potential redirect URLs
          let cleanUrl = result.url;

          // Remove any Brave redirect patterns if they exist
          if (cleanUrl.includes('brave.com/search/redirect')) {
            const urlMatch = cleanUrl.match(/url=([^&]+)/);
            if (urlMatch) {
              cleanUrl = decodeURIComponent(urlMatch[1]);
            }
          }

          results.push({
            title: result.title,
            url: cleanUrl,
            snippet: result.description,
            source: 'bing', // Changed from 'brave' to fix type error (function not used anyway)
          });
        }
      }
    }

    console.log(`Brave found ${results.length} results`);
    return results;
  } catch (error) {
    console.error('Brave search failed:', error);
    return [];
  }
}

// Advanced result deduplication and ranking
function deduplicateAndRank(results: SearchResult[]): SearchResult[] {
  // Group by normalized URL (remove fragments, trailing slashes, etc.)
  const urlGroups = new Map<string, SearchResult[]>();

  results.forEach((result) => {
    try {
      const url = new URL(result.url);
      const normalizedUrl =
        `${url.protocol}//${url.host}${url.pathname}`.toLowerCase();

      if (!urlGroups.has(normalizedUrl)) {
        urlGroups.set(normalizedUrl, []);
      }
      urlGroups.get(normalizedUrl)!.push(result);
    } catch (e) {
      // Handle malformed URLs by using original URL as key
      const key = result.url.toLowerCase();
      if (!urlGroups.has(key)) {
        urlGroups.set(key, []);
      }
      urlGroups.get(key)!.push(result);
    }
  });

  // Select best result from each group and calculate relevance scores
  const uniqueResults = Array.from(urlGroups.values()).map((group) => {
    // Prefer results with longer snippets and from multiple sources
    const bestResult = group.reduce((best, current) => {
      const bestScore = calculateRelevanceScore(best, group.length);
      const currentScore = calculateRelevanceScore(current, group.length);
      return currentScore > bestScore ? current : best;
    });

    // Add metadata about source diversity
    return {
      ...bestResult,
      sourceCount: group.length,
      sources: [...new Set(group.map((r) => r.source))],
    };
  });

  // Sort by relevance score
  return uniqueResults
    .map((result) => calculateRelevanceScore(result, result.sourceCount))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.result);
}

function calculateRelevanceScore(
  result: SearchResult & { sourceCount?: number },
  sourceCount: number = 1
) {
  let score = 0;

  // Base score from snippet length (longer = more informative)
  score += Math.min(result.snippet.length / 10, 50);

  // Bonus for appearing in multiple search engines
  score += sourceCount * 20;

  // Title relevance (shorter titles often more precise)
  score += Math.max(0, 100 - result.title.length);

  // Domain authority bonus (simple heuristic)
  const domain = result.url.toLowerCase();
  if (domain.includes('wikipedia.org')) score += 30;
  if (domain.includes('stackoverflow.com')) score += 25;
  if (domain.includes('github.com')) score += 20;
  if (domain.includes('.edu')) score += 15;
  if (domain.includes('.gov')) score += 15;

  // Source diversity bonus (prefer results from different engines)
  // if (result.source === 'brave') score += 10; // API results often higher quality (removed)
  if (result.source === 'startpage') score += 8; // Enhanced with metadata
  if (result.source === 'duckduckgo') score += 5;
  if (result.source === 'bing') score += 5;

  return {
    result,
    score,
  };
}

// Main search action
export async function searchMultipleEngines(
  params: SearchParams
): Promise<SearchResponse> {
  const startTime = Date.now();

  try {
    // Validate input
    const validatedParams = SearchParamsSchema.parse(params);
    const { query, limit } = validatedParams;

    // Rate limiting
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';

    if (!checkRateLimit(ip)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Execute searches in parallel with staggered delays to reduce load
    const searchPromises = [
      searchDuckDuckGo(query, limit),
      // Re-enable other engines to reduce dependency on DuckDuckGo
      new Promise<SearchResult[]>((resolve) =>
        setTimeout(() => searchStartpage(query, limit).then(resolve), 500)
      ), // 500ms delay
      new Promise<SearchResult[]>((resolve) =>
        setTimeout(() => searchBing(query, limit).then(resolve), 1000)
      ), // 1s delay
      // searchBrave(query, limit), // Commented out due to rate limits/pricing concerns
    ];

    const searchResults = await Promise.allSettled(searchPromises);

    // Collect successful results
    const allResults: SearchResult[] = [];
    const successfulSources: string[] = [];

    searchResults.forEach((result, index) => {
      const sourceName = ['duckduckgo', 'startpage', 'bing'][index];

      if (result.status === 'fulfilled') {
        console.log(`${sourceName}: ${result.value.length} results found`);
        if (result.value.length > 0) {
          allResults.push(...result.value);
          successfulSources.push(sourceName);
        }
      } else {
        console.error(`${sourceName} search failed:`, result.reason);
      }
    });

    console.log(
      `Total results collected: ${allResults.length} from sources: ${successfulSources.join(', ')}`
    );

    if (allResults.length === 0) {
      throw new Error('No search results found from any source');
    }

    // Log performance summary
    if (successfulSources.length >= 2) {
      console.log(
        `✅ Search successful with ${successfulSources.length} working engines`
      );
    } else if (successfulSources.length === 1) {
      console.log(`⚠️ Only 1 search engine working: ${successfulSources[0]}`);
    }

    // Deduplicate and rank results
    const rankedResults = deduplicateAndRank(allResults);
    const finalResults = rankedResults.slice(0, limit);

    const searchTime = Date.now() - startTime;

    return {
      results: finalResults,
      totalResults: finalResults.length,
      searchTime,
      sources: successfulSources,
    };
  } catch (error) {
    console.error('Search aggregation failed:', error);

    if (error instanceof z.ZodError) {
      throw new Error(
        `Invalid search parameters: ${error.errors.map((e) => e.message).join(', ')}`
      );
    }

    throw error;
  }
}

// Credit costs configuration
const SEARCH_CREDIT_COST = 1; // Easily adjustable for future changes

// Utility function for client-side usage
export async function performSearch(query: string, limit?: number) {
  // Check credits first
  const { checkAndDeductCredits } = await import('@/lib/payments/actions');
  const { auth } = await import('@/lib/auth');
  const { headers } = await import('next/headers');

  // Get current session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      success: false,
      error: 'Authentication required to use search features',
    };
  }

  try {
    // Check and deduct credits for search operation
    await checkAndDeductCredits('web_search', SEARCH_CREDIT_COST, {
      query,
      limit: limit ?? 10,
      timestamp: new Date().toISOString(),
    });

    const result = await searchMultipleEngines({ query, limit: limit ?? 10 });
    return { success: true, data: result };
  } catch (error: any) {
    if (error.message?.includes('Insufficient credits')) {
      return {
        success: false,
        error: error.message,
        code: 'INSUFFICIENT_CREDITS',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
