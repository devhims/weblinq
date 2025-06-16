// Studio API Client for web scraping and rendering operations
// Uses cookie forwarding for authentication

export interface ScreenshotRequest {
  url: string;
  // Legacy top-level fields (still accepted)
  fullPage?: boolean;
  width?: number;
  height?: number;
  format?: string;
  quality?: number;

  // New unified props
  waitTime?: number;
  screenshotOptions?: {
    captureBeyondViewport?: boolean;
    clip?: {
      height: number;
      width: number;
      x: number;
      y: number;
      scale?: number;
    };
    encoding?: 'binary' | 'base64';
    fromSurface?: boolean;
    fullPage?: boolean;
    omitBackground?: boolean;
    optimizeForSpeed?: boolean;
    quality?: number;
    type?: 'png' | 'jpeg' | 'webp';
  };
  viewport?: {
    height: number;
    width: number;
    deviceScaleFactor?: number;
    hasTouch?: boolean;
    isLandscape?: boolean;
    isMobile?: boolean;
  };
}

export interface ScreenshotResponse {
  success: boolean;
  data: {
    image: string;
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
}

export interface MarkdownRequest {
  url: string;
}

export interface MarkdownResponse {
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
}

export interface JsonExtractionRequest {
  url: string;
  schema: Record<string, any>;
  waitTime?: number;
  instructions?: string;
}

export interface JsonExtractionResponse {
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
}

export interface ContentRequest {
  url: string;
}

export interface ContentResponse {
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
}

export interface ScrapeRequest {
  url: string;
  elements: Array<{ selector: string; attributes?: string[] }>;
  waitTime?: number;
  headers?: Record<string, string>;
}

export interface ScrapeResponse {
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
}

export interface LinksRequest {
  url: string;
  includeExternal?: boolean;
  waitTime?: number;
}

export interface LinksResponse {
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
}

export interface SearchRequest {
  query: string;
  limit?: number;
}

export interface SearchResponse {
  success: boolean;
  data: {
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      source: 'duckduckgo' | 'startpage' | 'yandex' | 'bing';
    }>;
    metadata: {
      query: string;
      totalResults: number;
      searchTime: number;
      sources: string[];
      timestamp: string;
    };
  };
  creditsCost: number;
}

// Base API request function with error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(
    `${
      process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'
    }${endpoint}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Include session cookies
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  return null as T;
}

// Studio API functions
export const studioApi = {
  // Take a screenshot
  screenshot: (data: ScreenshotRequest): Promise<ScreenshotResponse> =>
    apiRequest('/web/screenshot', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Extract markdown
  markdown: (data: MarkdownRequest): Promise<MarkdownResponse> =>
    apiRequest('/web/markdown', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Extract structured JSON
  jsonExtraction: (
    data: JsonExtractionRequest
  ): Promise<JsonExtractionResponse> =>
    apiRequest('/web/extract-json', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get HTML content
  content: (data: ContentRequest): Promise<ContentResponse> =>
    apiRequest('/web/content', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Scrape elements
  scrape: (data: ScrapeRequest): Promise<ScrapeResponse> =>
    apiRequest('/web/scrape', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get links
  links: (data: LinksRequest): Promise<LinksResponse> =>
    apiRequest('/web/links', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Search web
  search: (data: SearchRequest): Promise<SearchResponse> =>
    apiRequest('/web/search', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
