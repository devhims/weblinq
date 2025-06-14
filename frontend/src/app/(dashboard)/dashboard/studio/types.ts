import {
  LucideIcon,
  Globe,
  Code,
  FileText,
  Camera,
  FileImage,
  FileJson,
  Link as LinkIcon,
  FileDown,
  Search,
} from 'lucide-react';

// API Endpoint definition
export type ApiEndpoint = {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  subActions?: ApiSubAction[];
};

// Define sub-actions for API endpoints
export type ApiSubAction = {
  id: string;
  name: string;
  description: string;
};

// Define API endpoints
export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'scrape',
    name: 'Scrape',
    icon: Code,
    description: 'Extract content and data from a webpage',
    subActions: [
      {
        id: 'markdown',
        name: 'Markdown',
        description: 'Extract content as Markdown from a webpage',
      },
      {
        id: 'html',
        name: 'HTML Content',
        description: 'Fetch raw HTML content from a webpage',
      },
      {
        id: 'links',
        name: 'Links',
        description: 'Extract all links from a webpage',
      },
      {
        id: 'elements',
        name: 'Specific Elements',
        description: 'Scrape specific HTML elements using CSS selectors',
      },
    ],
  },
  {
    id: 'visual',
    name: 'Visual Capture',
    icon: Camera,
    description: 'Capture visual representations of a webpage',
    subActions: [
      {
        id: 'screenshot',
        name: 'Screenshot',
        description: 'Capture a screenshot of a webpage',
      },
      {
        id: 'pdf',
        name: 'PDF',
        description: 'Render a webpage as PDF',
      },
    ],
  },
  {
    id: 'structured',
    name: 'Structured Data',
    icon: FileJson,
    description: 'Extract structured data from a webpage',
    subActions: [
      {
        id: 'json',
        name: 'JSON',
        description: 'Extract structured data in JSON format',
      },
    ],
  },
  {
    id: 'search',
    name: 'Search',
    icon: Search,
    description: 'Search the web for relevant results',
    subActions: [
      {
        id: 'web',
        name: 'Web Search',
        description: 'Search for information across the web',
      },
    ],
  },
];

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
