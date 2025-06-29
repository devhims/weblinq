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

// Import the settings defaults
const SETTINGS_STORAGE_KEY = 'weblink-studio-preferences';

// Function to load user preferences from localStorage
const loadUserPreferences = () => {
  if (typeof window === 'undefined') return {};

  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      const settings = JSON.parse(stored);

      // Map settings to studio parameters
      return {
        waitTime: settings.defaultWaitTime,
        format: settings.defaultScreenshotFormat,
        quality: settings.defaultQuality,
        width: settings.defaultViewportWidth,
        height: settings.defaultViewportHeight,
        mobile: settings.defaultMobileMode,
        fullPage: settings.defaultFullPage,
        limit: settings.defaultSearchLimit,
        onlyMainContent: settings.onlyMainContent,
        includeExternal: settings.includeExternalLinks,
        visibleLinksOnly: settings.visibleLinksOnly,
      };
    }
  } catch (error) {
    console.warn('Failed to load user preferences:', error);
  }

  return {};
};

// ---------------------------------------------------------------------------
// Type-safe parsers powered by the centrally-defined ID lists from endpoints.tsx
// ---------------------------------------------------------------------------

// Get user preferences for default values
const userPrefs = loadUserPreferences();

// Type-safe device enum
const deviceParser = parseAsStringLiteral(['iphone15', 'galaxyS24']).withDefault('iphone15');

// Type-safe endpoint and action parsers
const endpointParser = parseAsStringLiteral(ENDPOINT_IDS).withDefault('scrape');

const actionParser = parseAsStringLiteral(ACTION_IDS).withDefault('markdown');

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
  limit: parseAsInteger,

  // Generic options
  waitTime: parseAsInteger.withDefault(userPrefs.waitTime ?? undefined), // Apply user's preferred wait time

  // Scrape options
  selector: parseAsString,
  onlyMainContent: parseAsBoolean.withDefault(userPrefs.onlyMainContent ?? false),
  includeMarkdown: parseAsBoolean,
  includeExternal: parseAsBoolean.withDefault(userPrefs.includeExternal ?? true),
  visibleLinksOnly: parseAsBoolean.withDefault(userPrefs.visibleLinksOnly ?? false),

  // Screenshot options
  format: parseAsString.withDefault(userPrefs.format ?? 'png'),
  quality: parseAsInteger.withDefault(userPrefs.quality ?? 80),
  fullPage: parseAsBoolean.withDefault(userPrefs.fullPage ?? true),
  mobile: parseAsBoolean.withDefault(userPrefs.mobile ?? false),
  device: deviceParser,
  width: parseAsInteger.withDefault(userPrefs.width ?? undefined),
  height: parseAsInteger.withDefault(userPrefs.height ?? undefined),

  // Structured extraction
  jsonPrompt: parseAsString,
  jsonSchema: parseAsString,
  responseType: parseAsStringLiteral(['json', 'text']).withDefault('json'),

  // PDF options – simplified to waitTime only (handled via waitTime generic)
} as const;

export type StudioParams = inferParserType<typeof studioParsers>;

/**
 * Simplified studio parameters hook using pure nuqs + utility functions
 * Eliminates the complexity of studio-context.tsx while maintaining type safety
 * Now integrates with user preferences from localStorage
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
    // Load fresh user preferences for the new action
    const freshPrefs = loadUserPreferences();

    // Only preserve: endpoint, action, url
    // Reset everything else but apply user preferences where available
    const newParams: Partial<StudioParams> = {
      endpoint: newEndpoint,
      action: newAction,
      url: params.url, // Keep the current URL

      // Apply user preferences for the new action
      ...(freshPrefs.waitTime && { waitTime: freshPrefs.waitTime }),
      ...(freshPrefs.format && { format: freshPrefs.format }),
      ...(freshPrefs.quality && { quality: freshPrefs.quality }),
      ...(freshPrefs.width && { width: freshPrefs.width }),
      ...(freshPrefs.height && { height: freshPrefs.height }),
      ...(typeof freshPrefs.mobile === 'boolean' && { mobile: freshPrefs.mobile }),
      ...(typeof freshPrefs.fullPage === 'boolean' && { fullPage: freshPrefs.fullPage }),
      ...(freshPrefs.limit && { limit: freshPrefs.limit }),
      ...(typeof freshPrefs.onlyMainContent === 'boolean' && { onlyMainContent: freshPrefs.onlyMainContent }),
      ...(typeof freshPrefs.includeExternal === 'boolean' && { includeExternal: freshPrefs.includeExternal }),
      ...(typeof freshPrefs.visibleLinksOnly === 'boolean' && { visibleLinksOnly: freshPrefs.visibleLinksOnly }),
    };

    // Clear parameters that don't have user preferences by setting them to null
    Object.keys(studioParsers).forEach((key) => {
      if (!['endpoint', 'action', 'url'].includes(key) && !(key in newParams)) {
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
