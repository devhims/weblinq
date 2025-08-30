// Type definitions for result types
export type ScreenshotResult = {
  imageUrl: string | null;
};

export type LinksResult = string[];

export type ScrapeElement = {
  selector: string;
  attributes?: string[];
};

export type ScrapeOptions = {
  onlyMainContent?: boolean;
  headers?: Record<string, string>;
  waitTime?: number;
  mobile?: boolean;
  timeout?: number;
};

export type ScrapeResult = {
  elements: Array<{
    selector: string;
    results: Array<{
      attributes: Array<{ name: string; value: string }>;
      height: number;
      html: string;
      left: number;
      text: string;
      top: number;
      width: number;
    }>;
  }>;
};

// Search result types for V2 API
export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  favicon?: string;
  publishedDate?: string;
}

// JsonExtraction result type (imported from studio-api but re-exported here for convenience)
export interface JsonExtractionResult {
  success: boolean;
  data: {
    extracted?: Record<string, unknown>;
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

export interface SearchMetadata {
  query: string;
  totalResults: number;
  searchTime: number;
  timestamp: string;
  requestId?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  metadata?: SearchMetadata;
  // Legacy support for direct properties (for backward compatibility)
  totalResults?: number;
  searchTime?: number;
}

// Legacy V1 Search result types (keeping for backward compatibility)
export interface SearchResultV1 {
  title: string;
  url: string;
  snippet: string;
  source: 'duckduckgo' | 'startpage' | 'bing' | 'yandex';
}

export interface SearchMetadataV1 {
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
}

export interface SearchResponseV1 {
  results: SearchResultV1[];
  metadata?: SearchMetadataV1;
  // Legacy support for direct properties
  totalResults?: number;
  searchTime?: number;
  sources?: string[];
}

// YouTube result types
export type YouTubeCaption = {
  start: string;
  dur: string;
  text: string;
};

export type YouTubeVideoDetails = {
  title: string;
  description: string;
};

export type YouTubeCaptionsResult = {
  videoId: string;
  language: string;
  captions: YouTubeCaption[];
  videoDetails?: YouTubeVideoDetails;
  metadata: {
    totalCaptions: number;
    extractionTime: number;
    timestamp: string;
  };
};

export type ApiResult =
  | string
  | ScreenshotResult
  | ScrapeResult
  | LinksResult
  | SearchResponse
  | YouTubeCaptionsResult
  | JsonExtractionResult
  | { [key: string]: unknown }
  | unknown[]
  | null;
