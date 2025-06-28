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

// Search result types
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: 'duckduckgo' | 'startpage' | 'bing' | 'yandex';
}

export interface SearchMetadata {
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

export interface SearchResponse {
  results: SearchResult[];
  metadata?: SearchMetadata;
  // Legacy support for direct properties
  totalResults?: number;
  searchTime?: number;
  sources?: string[];
}

export type ApiResult =
  | string
  | ScreenshotResult
  | ScrapeResult
  | LinksResult
  | SearchResponse
  | { [key: string]: any }
  | Array<any>
  | null;
