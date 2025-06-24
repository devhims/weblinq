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

export type ApiResult =
  | string
  | ScreenshotResult
  | ScrapeResult
  | LinksResult
  | { [key: string]: any }
  | Array<any>
  | null;
