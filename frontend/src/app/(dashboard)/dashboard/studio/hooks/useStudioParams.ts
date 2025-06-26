'use client';

import {
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsBoolean,
  type inferParserType,
  parseAsStringLiteral,
} from 'nuqs';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { buildApiPayloadFromParams, validateParamsObject } from '../utils/api-builder';
import { ENDPOINT_IDS, ACTION_IDS, type EndpointId, type ActionId } from '../constants';

// ---------------------------------------------------------------------------
// Type-safe parsers powered by the centrally-defined ID lists from endpoints.tsx
// ---------------------------------------------------------------------------

// Type-safe device enum
const deviceParser = parseAsStringLiteral(['iphone15', 'galaxyS24']).withDefault('iphone15');

// Type-safe endpoint and action parsers
const endpointParser = parseAsStringLiteral(ENDPOINT_IDS).withDefault('scrape');

const actionParser = parseAsStringLiteral(ACTION_IDS).withDefault('elements');

// ---------------------------------------------------------------------------
//  1️⃣  Central list of query-param parsers (single source of truth)
// ---------------------------------------------------------------------------

export const studioParsers = {
  // Core parameters
  url: parseAsString.withDefault('https://example.com'),
  endpoint: endpointParser,
  action: actionParser,

  // Search parameters
  query: parseAsString.withDefault(''),
  limit: parseAsInteger.withDefault(10),

  // Generic options
  waitTime: parseAsInteger, // optional – undefined if not present

  // Scrape options
  selector: parseAsString,
  onlyMainContent: parseAsBoolean.withDefault(false),
  includeMarkdown: parseAsBoolean,
  includeExternal: parseAsBoolean.withDefault(true),
  visibleLinksOnly: parseAsBoolean.withDefault(false),

  // Screenshot options
  format: parseAsString.withDefault('png'),
  quality: parseAsInteger.withDefault(80),
  fullPage: parseAsBoolean.withDefault(true),
  mobile: parseAsBoolean.withDefault(false),
  device: deviceParser,
  width: parseAsInteger,
  height: parseAsInteger,

  // Structured extraction
  jsonPrompt: parseAsString,

  // PDF options – simplified to waitTime only (handled via waitTime generic)
} as const;

export type StudioParams = inferParserType<typeof studioParsers>;

/**
 * Simplified studio parameters hook using pure nuqs + utility functions
 * Eliminates the complexity of studio-context.tsx while maintaining type safety
 */
export function useStudioParams() {
  const searchParams = useSearchParams();

  // ---------------------------------------------------------------------
  // useQueryStates – single hook for all parameters
  // ---------------------------------------------------------------------
  const [params, setParams] = useQueryStates(studioParsers, { history: 'push' });

  // Convenience destructuring (back-compat names)
  const { url, query, limit, endpoint, action, format, quality, fullPage, mobile, device, width, height } = params;

  // Back-compat setter helpers ------------------------------------------------
  const setUrl = (v: string | null) => void setParams({ url: v });
  const setQuery = (v: string | null) => void setParams({ query: v });
  const setLimit = (v: number | null) => void setParams({ limit: v });
  const setEndpoint = (v: EndpointId | null) => void setParams({ endpoint: v });
  const setAction = (v: ActionId | null) => void setParams({ action: v });
  const setFormat = (v: string | null) => void setParams({ format: v });
  const setQuality = (v: number | null) => void setParams({ quality: v });
  const setFullPage = (v: boolean | null) => void setParams({ fullPage: v });
  const setMobile = (v: boolean | null) => void setParams({ mobile: v });
  const setDevice = (v: 'iphone15' | 'galaxyS24' | null) => void setParams({ device: v });
  const setWidth = (v: number | null) => void setParams({ width: v });
  const setHeight = (v: number | null) => void setParams({ height: v });

  // Ensure URL reflects defaults on initial load
  useEffect(() => {
    if (!searchParams.has('endpoint') || !searchParams.has('action') || !searchParams.has('url')) {
      // --> 2nd argument are per-call options
      setParams({ endpoint, action, url }, { clearOnDefault: false, history: 'replace' });
    }
  }, [searchParams, endpoint, action, url, setParams]);

  // Build API payload using utility function (legacy bridge)
  const getApiPayload = () => buildApiPayloadFromParams(params);

  // Validate current parameters (legacy bridge)
  const validateParams = () => validateParamsObject(params);

  // Simplified method to switch endpoint/action and reset all other parameters
  const switchAction = (newEndpoint: EndpointId, newAction: ActionId) => {
    // Only preserve: endpoint, action, url
    // Reset everything else to provide a clean slate for each action
    const newParams: Partial<StudioParams> = {
      endpoint: newEndpoint,
      action: newAction,
      url: params.url, // Keep the current URL
    };

    // Clear all other parameters by setting them to null
    Object.keys(studioParsers).forEach((key) => {
      if (!['endpoint', 'action', 'url'].includes(key)) {
        (newParams as any)[key] = null;
      }
    });

    // Update all parameters at once
    setParams(newParams, { history: 'push' });
  };

  return {
    // Core state
    url,
    setUrl,
    query,
    setQuery,
    limit,
    setLimit,
    endpoint,
    setEndpoint,
    action,
    setAction,

    // UI state
    format,
    setFormat,
    quality,
    setQuality,
    fullPage,
    setFullPage,
    mobile,
    setMobile,
    device,
    setDevice,
    width,
    setWidth,
    height,
    setHeight,

    // Utility functions
    getApiPayload,
    validateParams,
    switchAction,

    // Direct access to searchParams for remaining parameters
    searchParams,

    // Full params object access (new API)
    params,
    setParams,
  };
}
