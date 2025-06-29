// API Builder Utilities - Pure functions for nuqs + API transformation

// Import the studio API types for proper typing
import type {
  ScreenshotRequest,
  MarkdownRequest,
  ContentRequest,
  LinksRequest,
  ScrapeRequest,
  JsonExtractionRequest,
  SearchRequest,
  PdfRequest,
} from '@/lib/studio-api';

import { endpointActionSchemas } from '@/lib/studio-schemas';

// Import StudioParams type from the hook (avoids circular deps by using `type` only)
import type { StudioParams } from '../hooks/useStudioParams';

type ApiPayload =
  | ScreenshotRequest
  | MarkdownRequest
  | ContentRequest
  | LinksRequest
  | ScrapeRequest
  | JsonExtractionRequest
  | SearchRequest
  | PdfRequest;

// Type definitions for each endpoint/action combo
export type EndpointAction =
  | 'scrape/markdown'
  | 'scrape/html'
  | 'scrape/links'
  | 'scrape/elements'
  | 'visual/screenshot'
  | 'visual/pdf'
  | 'structured/json'
  | 'structured/text'
  | 'search/web';

// Main API payload builder - reads all params and transforms based on action
export function buildApiPayloadFromParams(params: StudioParams): {
  action: EndpointAction;
  payload: ApiPayload;
  error?: string;
} {
  const endpoint = params.endpoint ?? 'scrape';
  const action = params.action ?? 'markdown';
  const actionKey = `${endpoint}/${action}` as EndpointAction;

  // Validate required params early
  if (!params.url && endpoint !== 'search') {
    return { action: actionKey, payload: {} as ApiPayload, error: 'URL is required' };
  }
  if (!params.query && endpoint === 'search') {
    return { action: actionKey, payload: {} as ApiPayload, error: 'Search query is required' };
  }

  try {
    const undef = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);
    // ------------------ Table-driven builders -------------------
    const builders: Record<EndpointAction, (p: StudioParams) => ApiPayload> = {
      'scrape/markdown': (p) => ({ url: p.url!, waitTime: undef(p.waitTime) } as MarkdownRequest),

      'scrape/html': (p) => ({ url: p.url!, waitTime: undef(p.waitTime) } as ContentRequest),

      'scrape/links': (p) =>
        ({
          url: p.url!,
          includeExternal: p.includeExternal ?? true,
          visibleLinksOnly: p.visibleLinksOnly,
          waitTime: undef(p.waitTime),
        } as LinksRequest),

      'scrape/elements': (p) => {
        // Build elements array
        let elements;
        if (p.selector) {
          elements = p.selector
            .split(',')
            .map((s: string) => ({ selector: s.trim() }))
            .filter((e: { selector: string }) => Boolean(e.selector));
        } else if (p.onlyMainContent) {
          elements = [
            { selector: 'h1' },
            { selector: 'h2' },
            { selector: 'h3' },
            { selector: '.section-heading' },
            { selector: 'main' },
            { selector: 'article' },
            { selector: '#main' },
            { selector: '#content' },
            { selector: '.main' },
            { selector: '.content' },
            { selector: '.post' },
            { selector: '.article' },
            { selector: '[role="main"]' },
            { selector: '.main-content' },
          ];
        } else {
          elements = [{ selector: 'h1' }];
        }

        return {
          url: p.url!,
          elements,
          waitTime: undef(p.waitTime),
        } as ScrapeRequest;
      },

      'visual/screenshot': (p) => {
        const format = (p.format ?? 'png') as 'png' | 'jpeg' | 'webp';
        const viewport = p.mobile
          ? { width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }
          : {
              width: (p.width ?? 1920) as number,
              height: (p.height ?? 1080) as number,
              deviceScaleFactor: 1,
            };

        const screenshotOptions: any = { fullPage: p.fullPage, type: format };
        if (format !== 'png' && p.quality) screenshotOptions.quality = p.quality;

        return {
          url: p.url!,
          viewport,
          screenshotOptions,
          waitTime: undef(p.waitTime),
        } as ScreenshotRequest;
      },

      'visual/pdf': (p) => ({ url: p.url!, waitTime: undef(p.waitTime) } as PdfRequest),

      'structured/json': (p) => {
        const baseRequest: any = {
          url: p.url!,
          responseType: 'json' as 'json' | 'text',
          waitTime: undef(p.waitTime),
        };

        // Always include prompt if provided
        if (p.jsonPrompt && p.jsonPrompt.trim()) {
          baseRequest.prompt = p.jsonPrompt;
        }

        // Also include schema if provided (both can be used together)
        if (p.jsonSchema && p.jsonSchema.trim()) {
          try {
            const parsedSchema = JSON.parse(p.jsonSchema);
            baseRequest.response_format = {
              type: 'json_schema' as const,
              json_schema: parsedSchema,
            };
          } catch (error) {
            // If schema is invalid, just ignore it and use prompt only
            console.warn('Invalid JSON schema provided, using prompt only');
          }
        }

        // Ensure at least a prompt is provided if no schema
        if (!baseRequest.prompt && !baseRequest.response_format) {
          baseRequest.prompt = 'Extract the main information from this page';
        }

        return baseRequest as JsonExtractionRequest;
      },

      'structured/text': (p) => {
        return {
          url: p.url!,
          responseType: 'text' as 'json' | 'text',
          prompt: p.jsonPrompt || 'Summarize the main points and key information from this webpage.',
          waitTime: undef(p.waitTime),
        } as JsonExtractionRequest;
      },

      'search/web': (p) => ({ query: p.query!, limit: p.limit ?? 10 } as SearchRequest),
    } as const;

    if (!builders[actionKey]) {
      return { action: actionKey, payload: {} as ApiPayload, error: `Unknown action: ${actionKey}` };
    }

    let payload = builders[actionKey](params);

    // ---------------- Runtime validation (zod) ------------------
    const schema = (endpointActionSchemas as any)[actionKey];
    if (schema) {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        return {
          action: actionKey,
          payload: {} as ApiPayload,
          error: parsed.error.errors.map((e: any) => e.message).join(', '),
        };
      }
      payload = parsed.data as ApiPayload;
    }

    return { action: actionKey, payload };
  } catch (err) {
    return {
      action: actionKey,
      payload: {} as ApiPayload,
      error: err instanceof Error ? err.message : 'Unknown error building API payload',
    };
  }
}

// Helper to get allowed parameters for current action (extracted from schemas)
export function getAllowedParamsForAction(endpoint: string, action: string): string[] {
  const actionKey = `${endpoint}/${action}` as EndpointAction;

  // Always preserve core UI parameters
  const coreParams = ['endpoint', 'action', 'url'];

  // Get the schema for this action
  const schema = (endpointActionSchemas as any)[actionKey];
  if (!schema || !schema._def || !schema._def.shape) {
    return [...coreParams, 'url']; // fallback
  }

  // Extract parameter names from the Zod schema
  const schemaParams = Object.keys(schema._def.shape());

  // Handle special cases for UI-specific parameters that aren't in the API schema
  const uiSpecificParams: Record<EndpointAction, string[]> = {
    'scrape/elements': ['selector', 'onlyMainContent', 'includeMarkdown'],
    'visual/screenshot': ['mobile', 'device'], // UI params that map to viewport/screenshotOptions
    'structured/json': ['jsonPrompt', 'jsonSchema', 'responseType'], // UI params for structured extraction
    'structured/text': ['jsonPrompt', 'responseType'], // UI params for text extraction
    'scrape/markdown': [],
    'scrape/html': [],
    'scrape/links': [],
    'search/web': [],
    'visual/pdf': [],
  };

  // Combine schema params with UI-specific params
  const allParams = [...coreParams, ...schemaParams, ...(uiSpecificParams[actionKey] || [])];

  // Remove duplicates and return
  return [...new Set(allParams)];
}

// New validation util (params-based)
export function validateParamsObject(params: StudioParams): { valid: boolean; errors: string[] } {
  const { error } = buildApiPayloadFromParams(params);
  if (error) return { valid: false, errors: [error] };
  return { valid: true, errors: [] };
}

// ---------------------------------------------------------------------------
// Legacy shim: buildApiPayload(searchParams, nuqsParams)
// Keeps older call sites working while we migrate components.
// ---------------------------------------------------------------------------
export function buildApiPayload(
  searchParams: URLSearchParams,
  nuqsParams: { url?: string; query?: string; limit?: number },
) {
  const p: StudioParams = {
    url: nuqsParams.url,
    query: nuqsParams.query,
    limit: nuqsParams.limit,
    endpoint: searchParams.get('endpoint') ?? undefined,
    action: searchParams.get('action') ?? undefined,
    waitTime: searchParams.get('waitTime') ? Number(searchParams.get('waitTime')) : undefined,
    selector: searchParams.get('selector') ?? undefined,
    onlyMainContent: searchParams.get('onlyMainContent') === 'true' || undefined,
    includeExternal: searchParams.get('includeExternal') === 'true' || undefined,
    visibleLinksOnly: searchParams.get('visibleLinksOnly') === 'true' || undefined,
    format: searchParams.get('format') ?? undefined,
    quality: searchParams.get('quality') ? Number(searchParams.get('quality')) : undefined,
    fullPage: searchParams.get('fullPage') === 'true' || undefined,
    mobile: searchParams.get('mobile') === 'true' || undefined,
    device: searchParams.get('device') ?? undefined,
    width: searchParams.get('width') ? Number(searchParams.get('width')) : undefined,
    height: searchParams.get('height') ? Number(searchParams.get('height')) : undefined,
    jsonPrompt: searchParams.get('jsonPrompt') ?? undefined,
    includeMarkdown: searchParams.get('includeMarkdown') === 'true' || undefined,
  } as StudioParams;

  return buildApiPayloadFromParams(p);
}

// Legacy shim
export function validateCurrentParams(
  searchParams: URLSearchParams,
  nuqsParams: { url?: string; query?: string; limit?: number },
) {
  const { error } = buildApiPayload(searchParams, nuqsParams);
  return error ? { valid: false, errors: [error] } : { valid: true, errors: [] };
}
