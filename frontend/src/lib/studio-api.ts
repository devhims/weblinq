// Studio API Client for web scraping and rendering operations
// Uses cookie forwarding for authentication

export interface ScreenshotRequest {
  url: string;
  waitTime?: number;

  // Return format preference - controls whether response contains base64 string or binary data
  base64?: boolean;

  // Legacy top-level fields (still accepted)
  fullPage?: boolean;
  width?: number;
  height?: number;
  format?: string;
  quality?: number;

  // New unified props
  screenshotOptions?: {
    captureBeyondViewport?: boolean;
    clip?: {
      height: number;
      width: number;
      x: number;
      y: number;
      scale?: number;
    };
    encoding?: 'binary' | 'base64'; // Note: API always returns base64 regardless of this setting
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
    image: Uint8Array; // Binary data by default for optimal performance
    metadata: {
      width: number;
      height: number;
      format: string;
      size: number;
      url: string;
      timestamp: string;
    };
    permanentUrl?: string; // Permanent R2 storage URL for the image
    fileId?: string; // Unique file ID for tracking
  };
  creditsCost: number;
}

export interface MarkdownRequest {
  url: string;
  waitTime?: number;
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
  waitTime?: number;
  responseType?: 'json' | 'text';
  prompt?: string;
  response_format?: {
    type: 'json_schema';
    json_schema: Record<string, any>;
  };
  instructions?: string;
}

export interface JsonExtractionResponse {
  success: boolean;
  data: {
    // For JSON responses: structured data object
    extracted?: Record<string, any>;
    // For text responses: natural language text
    text?: string;
    metadata: {
      url: string;
      timestamp: string;
      model: string;
      responseType: 'json' | 'text';
      extractionType: 'prompt' | 'schema';
      fieldsExtracted?: number;
      inputTokens?: number;
      outputTokens?: number;
    };
  };
  creditsCost: number;
}

export interface ContentRequest {
  url: string;
  waitTime?: number;
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
      data?: Record<string, any> | Record<string, any>[];
      results?: Array<Record<string, any>>;
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

// Legacy V1 Search Response (keeping for backward compatibility)
export interface SearchResponseV1 {
  success: boolean;
  data: {
    results: Array<{
      title: string;
      url: string;
      snippet: string;
      source: 'duckduckgo' | 'startpage' | 'bing';
    }>;
    metadata: {
      query: string;
      totalResults: number;
      searchTime: number;
      sources: string[];
      timestamp: string;
      debug?: {
        engines: Record<
          string,
          {
            count: number;
            searchTime: number;
            success: boolean;
          }
        >;
        totalEngines: number;
        deduplicationStats: {
          rawResults: number;
          uniqueResults: number;
          finalResults: number;
        };
      };
    };
  };
  creditsCost: number;
}

// V2 Search Response (current)
export interface SearchResponse {
  success: boolean;
  data: {
    results: Array<{
      id: string;
      title: string;
      url: string;
      snippet: string;
      favicon?: string;
      publishedDate?: string;
    }>;
    metadata: {
      query: string;
      totalResults: number;
      searchTime: number;
      timestamp: string;
      requestId?: string;
    };
  };
  creditsCost: number;
}

export interface PdfRequest {
  url: string;
  waitTime?: number;
  // Return format preference - controls whether response contains base64 string or binary data
  base64?: boolean;
}

export interface PdfResponse {
  success: boolean;
  data: {
    pdf: Uint8Array; // Binary data by default for optimal performance
    metadata: {
      size: number;
      url: string;
      timestamp: string;
    };
    permanentUrl?: string; // Permanent R2 storage URL for the PDF
    fileId?: string; // Unique file ID for tracking
  };
  creditsCost: number;
}

// --------------------------------------------------------------
//  File listing (debug) types
// --------------------------------------------------------------

export interface ListFilesParams {
  type?: 'screenshot' | 'pdf';
  limit?: number;
  offset?: number;
  sort_by?: 'created_at' | 'filename';
  order?: 'asc' | 'desc';
}

export interface FileRecord {
  id: string;
  type: 'screenshot' | 'pdf';
  url: string;
  filename: string;
  r2_key: string;
  public_url: string;
  metadata: string;
  created_at: string;
  expires_at?: string;
}

export interface ListFilesResponse {
  success: boolean;
  data: {
    sqliteStatus: {
      enabled: boolean;
      available: boolean;
      userId: string;
    };
    files: FileRecord[];
    totalFiles: number;
    hasMore: boolean;
  };
}

export interface DeleteFileRequest {
  fileId: string;
  deleteFromR2?: boolean;
}

export interface DeleteFileResponse {
  success: boolean;
  data: {
    fileId: string;
    wasFound: boolean;
    deletedFromDatabase: boolean;
    deletedFromR2: boolean;
    deletedFile?: FileRecord;
    error?: string;
  };
}

import { parseErrorResponse } from './error-utils';
import { isVercelPreview, getApiKeyFromStorage } from '@/lib/utils';

// Generic binary API request function for images, PDFs and binary content
async function apiBinaryRequest(
  endpoint: string,
  options: RequestInit = {},
  expectedContentType?: string,
): Promise<any> {
  // Check if we're in preview mode and need API key auth
  const headers: Record<string, string> = {
    Accept: expectedContentType || 'application/pdf', // Default to PDF for backward compatibility
  };

  // Merge existing headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  // Add API key for preview environments
  if (isVercelPreview()) {
    const apiKey = getApiKeyFromStorage();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}${endpoint}`,
    {
      ...options,
      headers,
      credentials: 'include',
    },
  );

  if (!response.ok) {
    const apiError = await parseErrorResponse(response);
    throw apiError;
  }

  // Check if we got binary or JSON response
  const contentType = response.headers.get('content-type');

  if (
    contentType &&
    (contentType.includes('application/pdf') || contentType.includes('image/'))
  ) {
    // Binary response (PDF or Image)
    const data = new Uint8Array(await response.arrayBuffer());
    const metadata = JSON.parse(response.headers.get('X-Metadata') || '{}');
    const creditsCost = parseInt(response.headers.get('X-Credits-Cost') || '0');
    const permanentUrl =
      response.headers.get('X-Permanent-Url')?.trim() || undefined;
    const fileId = response.headers.get('X-File-Id')?.trim() || undefined;

    const responseData = contentType.includes('application/pdf')
      ? { pdf: data, metadata, permanentUrl, fileId }
      : { image: data, metadata, permanentUrl, fileId };

    return {
      success: true,
      data: responseData,
      creditsCost,
    };
  } else {
    // JSON response (likely an error or base64 fallback)
    const result = await response.json();
    if (result.success && typeof result.data.pdf === 'string') {
      // Convert base64 PDF to binary
      const byteCharacters = atob(result.data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const uint8Array = new Uint8Array(byteNumbers);

      return {
        ...result,
        data: {
          ...result.data,
          pdf: uint8Array,
        },
      };
    } else if (result.success && typeof result.data.image === 'string') {
      // Convert base64 image to binary
      const base64Data = result.data.image.replace(
        /^data:image\/[a-z]+;base64,/,
        '',
      );
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const uint8Array = new Uint8Array(byteNumbers);

      return {
        ...result,
        data: {
          ...result.data,
          image: uint8Array,
        },
      };
    }
    return result;
  }
}

// Base API request function with error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // Check if we're in preview mode and need API key auth
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Merge existing headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  // Add API key for preview environments
  if (isVercelPreview()) {
    const apiKey = getApiKeyFromStorage();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}${endpoint}`,
    {
      ...options,
      headers,
      credentials: 'include', // Include session cookies (for production)
    },
  );

  if (!response.ok) {
    const apiError = await parseErrorResponse(response);
    throw apiError;
  }

  // Handle empty responses
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await response.json();
  }

  return null as T;
}

// Client-side authenticated request helper (for mutations from client components)
async function clientApiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787'}${endpoint}`;

  // Prepare headers with potential API key auth for preview environments
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Merge existing headers safely
  if (options.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });
  }

  // Add API key for preview environments
  if (isVercelPreview()) {
    const apiKey = getApiKeyFromStorage();
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Cross-subdomain cookies
    headers,
  });

  if (!response.ok) {
    const apiError = await parseErrorResponse(response);
    throw apiError;
  }

  const data = await response.json();
  return data.data || data; // Handle both wrapped and unwrapped responses
}

// Studio API functions
export const studioApi = {
  // Take a screenshot (Binary response by default for optimal performance)
  screenshot: (data: ScreenshotRequest): Promise<ScreenshotResponse> => {
    const format = data.format || data.screenshotOptions?.type || 'png';
    return apiBinaryRequest(
      '/v1/web/screenshot',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, base64: false }),
      },
      `image/${format}`,
    );
  },

  // Extract markdown
  markdown: (data: MarkdownRequest): Promise<MarkdownResponse> =>
    apiRequest('/v1/web/markdown', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // AI extract structured data
  jsonExtraction: (
    data: JsonExtractionRequest,
  ): Promise<JsonExtractionResponse> =>
    apiRequest('/v1/web/ai-extract', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get HTML content
  content: (data: ContentRequest): Promise<ContentResponse> =>
    apiRequest('/v1/web/content', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Scrape elements
  scrape: (data: ScrapeRequest): Promise<ScrapeResponse> =>
    apiRequest('/v1/web/scrape', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Get links
  links: (data: LinksRequest): Promise<LinksResponse> =>
    apiRequest('/v1/web/links', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Search web (V2 API)
  search: (data: SearchRequest): Promise<SearchResponse> =>
    apiRequest('/v2/web/search', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Legacy V1 search (keeping for backward compatibility)
  searchLegacy: (data: SearchRequest): Promise<SearchResponseV1> =>
    apiRequest('/v1/web/search', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Generate PDF (Binary response by default for optimal performance)
  pdf: (data: PdfRequest): Promise<PdfResponse> =>
    apiBinaryRequest(
      '/v1/web/pdf',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, base64: false }),
      },
      'application/pdf',
    ),

  // List stored files
  listFiles: (
    params: ListFilesParams = {},
    extraHeaders: Record<string, string> = {},
  ): Promise<ListFilesResponse> => {
    const qs = new URLSearchParams();
    if (params.type) qs.append('type', params.type);
    if (params.limit) qs.append('limit', params.limit.toString());
    if (params.offset) qs.append('offset', params.offset.toString());
    if (params.sort_by) qs.append('sort_by', params.sort_by);
    if (params.order) qs.append('order', params.order);

    const queryString = qs.toString() ? `?${qs.toString()}` : '';

    return apiRequest(`/v1/files/list${queryString}`, {
      method: 'GET',
      headers: {
        ...extraHeaders,
      },
    });
  },
};

// Server-side files API function (for server components)
export async function listFilesServer(
  params?: ListFilesParams,
): Promise<ListFilesResponse> {
  // Dynamic import to avoid issues in client-side bundling
  const { cookies } = await import('next/headers');

  const url = new URL(
    '/v1/files/list',
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787',
  );

  // Add query parameters
  if (params) {
    if (params.type) url.searchParams.set('type', params.type);
    if (params.limit !== undefined)
      url.searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined)
      url.searchParams.set('offset', params.offset.toString());
    if (params.sort_by) url.searchParams.set('sort_by', params.sort_by);
    if (params.order) url.searchParams.set('order', params.order);
  }

  console.log(`🌐 [Server Files API] Making request to: ${url.toString()}`);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(cookieHeader && { Cookie: cookieHeader }),
  };

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  console.log(
    `🌐 [Server Files API] Status: ${response.status} ${response.statusText}`,
  );

  if (!response.ok) {
    const error = await response.text();
    console.error(`🌐 [Server Files API Error] ${response.status}: ${error}`);
    throw new Error(
      `Failed to fetch files: ${response.status} ${response.statusText}`,
    );
  }

  const result = await response.json();
  console.log(`🌐 [Server Files API Success] Response data:`, result);
  return result;
}

// Add files to the client API exports
export const filesApi = {
  list: (params?: ListFilesParams): Promise<ListFilesResponse> =>
    apiRequest(
      `/v1/files/list?${new URLSearchParams(
        Object.entries(params || {})
          .filter(([, value]) => value !== undefined)
          .map(([key, value]) => [key, value.toString()]),
      ).toString()}`,
      { method: 'GET' },
    ),

  delete: (data: DeleteFileRequest): Promise<DeleteFileResponse> =>
    clientApiRequest('/v1/files/delete', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// User API types and functions
export type UserCreditsRequest = object;

export interface UserCreditsResponse {
  success: boolean;
  data: {
    balance: number;
    plan: 'free' | 'pro';
    lastRefill: string | null;
  };
}

export interface VerifyEmailRequest {
  email: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  data: {
    exists: boolean;
    email: string;
  };
}

export type BootstrapCreditsRequest = object;

// User API functions
export const userApi = {
  // Get user credit information
  getCredits: (): Promise<UserCreditsResponse> =>
    apiRequest('/v1/user/credits', {
      method: 'GET',
    }),

  // Verify if email exists
  verifyEmail: (data: VerifyEmailRequest): Promise<VerifyEmailResponse> =>
    apiRequest('/v1/user/verify-email', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Note: bootstrapCredits endpoint now requires admin privileges
  // and should be called via admin panel, not from regular user context
};
