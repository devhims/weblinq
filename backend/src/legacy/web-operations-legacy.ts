import type { z } from 'zod';

import { Buffer } from 'node:buffer';

import type { screenshotInputSchema } from '@/routes/web/web.routes';

import { performWebSearch } from '@/routes/web/web.search-handler';

// Credit costs configuration - matches frontend actions.ts
const CREDIT_COSTS = {
  screenshot: 1,
  markdown: 1,
  json_extraction: 1,
  scrape_content: 1,
  scrape_elements: 1,
  scrape_links: 1,
  web_search: 1,
  pdf: 1,
} as const;

// Type definitions for API responses
interface CloudflareApiResponse {
  success: boolean;
  result?: any;
  errors?: any;
}

/**
 * Legacy implementation: Take a screenshot of a webpage using Cloudflare Browser Rendering API
 */
export async function screenshotLegacy(
  env: CloudflareBindings,
  params: z.infer<typeof screenshotInputSchema>,
  userId?: string,
  storeFileCallback?: (
    data: Uint8Array | Buffer,
    url: string,
    type: 'screenshot' | 'pdf',
    metadata: Record<string, any>,
    format?: string,
  ) => Promise<{
    fileId: string;
    permanentUrl: string;
    r2Key: string;
    filename: string;
  }>,
): Promise<{
  success: boolean;
  data: {
    image: string;
    permanentUrl?: string;
    fileId?: string;
    metadata: {
      width: number;
      height: number;
      format: string;
      size: number;
      url: string;
      timestamp: string;
    };
  };
  creditsCost: number;
}> {
  const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = env;

  try {
    const payload: Record<string, any> = {
      url: params.url,
      screenshotOptions: params.screenshotOptions || {},
      viewport: params.viewport,
      gotoOptions: {
        waitUntil: 'networkidle0',
        timeout: 45000,
      },
    };

    if (params.waitTime && params.waitTime > 0) {
      payload.waitFor = params.waitTime;
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API error: ${response.status} ${errorText}`);
    }

    // Check content type to handle different response formats
    const contentType = response.headers.get('content-type');
    let imageBuffer: Buffer;
    let base64Image: string;

    if (contentType?.includes('application/json')) {
      // Handle JSON response
      const jsonData = (await response.json()) as CloudflareApiResponse;

      if (!jsonData.success) {
        throw new Error(`Screenshot failed: ${JSON.stringify(jsonData.errors)}`);
      }

      // If JSON response contains base64 image
      if (jsonData.result) {
        base64Image = String(jsonData.result);
        imageBuffer = Buffer.from(base64Image, 'base64');
      } else {
        throw new Error('No image data in response');
      }
    } else {
      // Handle binary response (image data)
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      base64Image = imageBuffer.toString('base64');
    }

    const format = params.screenshotOptions?.type ?? 'png';
    const metadata = {
      width: params.viewport?.width ?? 1280,
      height: params.viewport?.height ?? 800,
      format,
      size: imageBuffer.length,
      url: params.url,
      timestamp: new Date().toISOString(),
    };

    // Create permanent URL if user is initialized and storage callback is provided
    let permanentUrl: string | undefined;
    let fileId: string | undefined;

    if (userId && storeFileCallback) {
      try {
        const storageResult = await storeFileCallback(imageBuffer, params.url, 'screenshot', metadata, format);
        permanentUrl = storageResult.permanentUrl;
        fileId = storageResult.fileId;
      } catch (storageError) {
        console.error('❌ Failed to create permanent URL for screenshot:', storageError);
        // Continue without permanent URL - don't fail the entire operation
      }
    }

    return {
      success: true,
      data: {
        image: base64Image,
        permanentUrl,
        fileId,
        metadata,
      },
      creditsCost: CREDIT_COSTS.screenshot,
    };
  } catch (error) {
    console.error('Screenshot error:', error);
    throw new Error(`Failed to capture screenshot: ${error}`);
  }
}

/**
 * Legacy implementation: Extract markdown content from a webpage
 */
export async function extractMarkdownLegacy(
  env: CloudflareBindings,
  params: { url: string; waitTime?: number },
): Promise<{
  success: boolean;
  data: {
    markdown: string;
    metadata: {
      title?: string;
      description?: string;
      url: string;
      timestamp: string;
      wordCount: number;
    };
  };
  creditsCost: number;
}> {
  const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = env;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/markdown`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: params.url }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Markdown extraction failed: ${response.status} ${errorText}`);
    }

    // Handle JSON response
    const jsonData = (await response.json()) as CloudflareApiResponse;

    if (!jsonData.success) {
      throw new Error(`Markdown extraction failed: ${JSON.stringify(jsonData.errors)}`);
    }

    const markdownContent = String(jsonData.result || '');

    return {
      success: true,
      data: {
        markdown: markdownContent,
        metadata: {
          url: params.url,
          timestamp: new Date().toISOString(),
          wordCount: markdownContent.split(/\s+/).length,
          title: undefined,
          description: undefined,
        },
      },
      creditsCost: CREDIT_COSTS.markdown,
    };
  } catch (error) {
    console.error('Markdown extraction error:', error);
    throw new Error(`Failed to extract markdown: ${error}`);
  }
}

/**
 * Legacy implementation: Extract structured JSON data from a webpage
 */
export async function extractJsonLegacy(
  env: CloudflareBindings,
  params: {
    url: string;
    schema?: Record<string, any>;
    waitTime?: number;
    instructions?: string;
  },
): Promise<{
  success: boolean;
  data: {
    extracted: Record<string, any>;
    metadata: {
      url: string;
      timestamp: string;
      fieldsExtracted: number;
    };
  };
  creditsCost: number;
}> {
  const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = env;

  try {
    // Construct the payload similar to frontend
    const payload: Record<string, any> = {
      url: params.url,
      gotoOptions: {
        waitUntil: 'networkidle0',
        timeout: 45000,
      },
    };

    // Add prompt if provided (using instructions as prompt)
    if (params.instructions) {
      payload.prompt = params.instructions;
    }

    // Add waitTime if provided
    if (params.waitTime && params.waitTime > 0) {
      payload.waitForTimeout = params.waitTime;
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`JSON extraction failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as CloudflareApiResponse;

    if (!data.success || !data.result) {
      throw new Error('JSON extraction failed: No result in response');
    }

    const extractedData = data.result as Record<string, any>;

    return {
      success: true,
      data: {
        extracted: extractedData,
        metadata: {
          url: params.url,
          timestamp: new Date().toISOString(),
          fieldsExtracted: Object.keys(extractedData || {}).length,
        },
      },
      creditsCost: CREDIT_COSTS.json_extraction,
    };
  } catch (error) {
    console.error('JSON extraction error:', error);
    throw new Error(`Failed to extract JSON data: ${error}`);
  }
}

/**
 * Legacy implementation: Get raw HTML content from a webpage
 */
export async function getContentLegacy(
  env: CloudflareBindings,
  params: { url: string; waitTime?: number },
): Promise<{
  success: boolean;
  data: {
    content: string;
    metadata: {
      title?: string;
      description?: string;
      url: string;
      timestamp: string;
      contentType: string;
    };
  };
  creditsCost: number;
}> {
  const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = env;

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/content`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: params.url }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTML content fetch failed: ${response.status} ${errorText}`);
    }

    // Check content type to determine response format
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      // Handle JSON response
      const jsonData = (await response.json()) as CloudflareApiResponse;

      if (!jsonData.success) {
        throw new Error(`HTML content fetch failed: ${JSON.stringify(jsonData.errors)}`);
      }

      // Return the HTML content from result property - matching schema
      return {
        success: true,
        data: {
          content: String(jsonData.result || ''),
          metadata: {
            url: params.url,
            timestamp: new Date().toISOString(),
            contentType: 'text/html',
            title: undefined,
            description: undefined,
          },
        },
        creditsCost: CREDIT_COSTS.scrape_content,
      };
    } else {
      // Direct HTML response
      const htmlContent = await response.text();
      return {
        success: true,
        data: {
          content: htmlContent,
          metadata: {
            url: params.url,
            timestamp: new Date().toISOString(),
            contentType: 'text/html',
            title: undefined,
            description: undefined,
          },
        },
        creditsCost: CREDIT_COSTS.scrape_content,
      };
    }
  } catch (error) {
    console.error('Content extraction error:', error);
    throw new Error(`Failed to extract content: ${error}`);
  }
}

/**
 * Legacy implementation: Scrape specific elements from a webpage
 */
export async function scrapeElementsLegacy(
  env: CloudflareBindings,
  params: {
    url: string;
    elements: Array<{
      selector: string;
      attributes?: string[];
    }>;
    waitTime?: number;
    headers?: Record<string, string>;
  },
): Promise<{
  success: boolean;
  data: {
    elements: Array<{
      selector: string;
      data: Record<string, any>;
    }>;
    metadata: {
      url: string;
      timestamp: string;
      elementsFound: number;
    };
  };
  creditsCost: number;
}> {
  const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = env;

  try {
    // Construct the payload with only supported parameters (matching frontend)
    const payload: Record<string, any> = {
      url: params.url,
      elements: params.elements,
      gotoOptions: {
        waitUntil: 'networkidle0',
        timeout: 45000,
      },
    };

    // Add optional parameters if provided
    if (params.waitTime && params.waitTime > 0) {
      payload.waitForTimeout = params.waitTime;
    }

    if (params.headers && Object.keys(params.headers).length > 0) {
      payload.setExtraHTTPHeaders = params.headers;
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/scrape`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Scrape failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as CloudflareApiResponse;

    if (!data.success || !data.result) {
      throw new Error('Scrape failed: No result in response');
    }

    // Transform the result to match schema expectations
    const elementsArray = Array.isArray(data.result) ? data.result : [];
    const transformedElements = elementsArray.map((element: any) => ({
      selector: String(element.selector || ''),
      data: (element.data || element) as Record<string, any>,
    }));

    return {
      success: true,
      data: {
        elements: transformedElements,
        metadata: {
          url: params.url,
          timestamp: new Date().toISOString(),
          elementsFound: transformedElements.length,
        },
      },
      creditsCost: CREDIT_COSTS.scrape_elements,
    };
  } catch (error) {
    console.error('Element scraping error:', error);
    throw new Error(`Failed to scrape elements: ${error}`);
  }
}

/**
 * Legacy implementation: Extract all links from a webpage
 */
export async function extractLinksLegacy(
  env: CloudflareBindings,
  params: { url: string; includeExternal?: boolean; waitTime?: number },
): Promise<{
  success: boolean;
  data: {
    links: Array<{
      url: string;
      text: string;
      type: 'internal' | 'external';
    }>;
    metadata: {
      url: string;
      timestamp: string;
      totalLinks: number;
      internalLinks: number;
      externalLinks: number;
    };
  };
  creditsCost: number;
}> {
  const { CLOUDFLARE_ACCESS_TOKEN, CLOUDFLARE_ACCOUNT_ID } = env;

  try {
    const payload = {
      url: params.url,
      visibleLinksOnly: false, // Match frontend default
    };

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/browser-rendering/links`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLOUDFLARE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Links retrieval failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as CloudflareApiResponse;

    if (!data.success || !data.result) {
      throw new Error('Links retrieval failed: No result in response');
    }

    const links = Array.isArray(data.result) ? data.result : [];

    return {
      success: true,
      data: {
        links: links.map((link: any) => ({
          url: String(link.url || link.href || ''),
          text: String(link.text || link.title || ''),
          type: (link.internal ? 'internal' : 'external') as 'internal' | 'external',
        })),
        metadata: {
          url: params.url,
          timestamp: new Date().toISOString(),
          totalLinks: links.length,
          internalLinks: links.filter((l: any) => l.internal).length,
          externalLinks: links.filter((l: any) => !l.internal).length,
        },
      },
      creditsCost: CREDIT_COSTS.scrape_links,
    };
  } catch (error) {
    console.error('Link extraction error:', error);
    throw new Error(`Failed to extract links: ${error}`);
  }
}

/**
 * Legacy implementation: Perform web search using multiple search engines
 */
export async function searchLegacy(
  params: {
    query: string;
    limit?: number;
  },
  clientIp?: string,
) {
  try {
    const searchResult = await performWebSearch({
      query: params.query,
      limit: params.limit || 10,
      clientIp,
    });

    return {
      success: true,
      data: {
        results: searchResult.results,
        metadata: {
          query: params.query,
          totalResults: searchResult.totalResults,
          searchTime: searchResult.searchTime,
          sources: searchResult.sources,
          timestamp: new Date().toISOString(),
        },
      },
      creditsCost: CREDIT_COSTS.web_search,
    };
  } catch (error) {
    console.error('Web search error:', error);
    throw new Error(`Failed to perform search: ${error}`);
  }
}

/**
 * Simple HTML to Markdown conversion
 * Note: This is a basic implementation. For production, consider using a library like turndown
 */
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n')
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    })
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
      let counter = 1;
      return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`);
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '') // Remove remaining HTML tags
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up multiple newlines
    .trim();
}

/**
 * Simple JSON extraction from HTML
 * Note: This is a basic implementation. For production, consider using AI or more sophisticated parsing
 */
export function extractJsonFromHtml(html: string, schema: Record<string, any>): Record<string, any> {
  const extracted: Record<string, any> = {};

  // Basic extraction based on common patterns
  for (const [key, type] of Object.entries(schema)) {
    if (typeof type === 'string' && type === 'string') {
      // Try to extract text content
      if (key.toLowerCase().includes('title')) {
        const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i) || html.match(/<h1[^>]*>(.*?)<\/h1>/i);
        if (titleMatch) {
          extracted[key] = titleMatch[1].replace(/<[^>]*>/g, '').trim();
        }
      } else if (key.toLowerCase().includes('description')) {
        const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/i);
        if (descMatch) {
          extracted[key] = descMatch[1].trim();
        }
      }
    }
  }

  return extracted;
}

/**
 * Parse elements from HTML
 */
export function parseElementsFromHtml(
  html: string,
  selectors: Array<{ selector: string; attributes?: string[] }>,
): Array<any> {
  const elements: Array<any> = [];

  // Basic HTML parsing - in production, use a proper DOM parser
  for (const { selector, attributes } of selectors) {
    // Simple implementation for common selectors
    if (selector.startsWith('.')) {
      const className = selector.slice(1);
      const regex = new RegExp(`<[^>]*class="[^"]*${className}[^"]*"[^>]*>(.*?)</[^>]*>`, 'gi');

      const matches = html.matchAll(regex);
      for (const match of matches) {
        elements.push({
          selector,
          content: match[1].replace(/<[^>]*>/g, '').trim(),
          attributes: attributes || [],
        });
      }
    }
  }

  return elements;
}

/**
 * Extract links from HTML
 */
export function extractLinksFromHtml(
  html: string,
  baseUrl: string,
  includeExternal: boolean,
): Array<{ url: string; text: string; internal: boolean }> {
  const links: Array<{ url: string; text: string; internal: boolean }> = [];
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi;
  const baseDomain = new URL(baseUrl).hostname;

  const matches = html.matchAll(linkRegex);
  for (const match of matches) {
    const url = match[1];
    const text = match[2].replace(/<[^>]*>/g, '').trim();

    if (!url || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      continue;
    }

    let fullUrl: string;
    let isInternal: boolean;

    try {
      if (url.startsWith('http')) {
        fullUrl = url;
        isInternal = new URL(url).hostname === baseDomain;
      } else {
        fullUrl = new URL(url, baseUrl).toString();
        isInternal = true;
      }

      if (!includeExternal && !isInternal) {
        continue;
      }

      links.push({
        url: fullUrl,
        text,
        internal: isInternal,
      });
    } catch {
      // Skip invalid URLs
      continue;
    }
  }

  return links;
}
