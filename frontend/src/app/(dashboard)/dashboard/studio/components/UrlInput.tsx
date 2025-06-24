'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTransition, useEffect } from 'react';
import React from 'react';

import { studioApi } from '@/lib/studio-api';
import type {
  MarkdownRequest,
  ScreenshotRequest,
  ContentRequest,
  LinksRequest,
  ScrapeRequest,
  JsonExtractionRequest,
  SearchRequest,
} from '@/lib/studio-api';
import { ApiResult } from '../types';
import { filterMainContent } from '../utils/mainContent';
import { useStudioParams } from '../hooks/useStudioParams';

/* ──────────────────────────────────────────────────────────────
   PURE NUQS + UTILITY FUNCTIONS APPROACH:
   
   This component now uses:
   
   import { useStudioParams } from '../hooks/useStudioParams';
   const { getApiPayload, validateParams } = useStudioParams();
   
   const validation = validateParams(); // { valid: boolean, errors: string[] }
   const { action, payload, error } = getApiPayload(); // Type-safe API payload
   
   if (validation.valid && !error) {
     const result = await studioApi[action](payload);
   }
   
   Benefits:
   - Direct URL parameter management with nuqs
   - Pure utility functions for transformations
   - No complex context abstraction
   - Type-safe API calls
──────────────────────────────────────────────────────────────── */

/* ──────────────────────────────────────────────────────────────
   Constants
──────────────────────────────────────────────────────────────── */
const MAIN_CONTENT_SELECTORS = [
  'h1',
  'h2',
  'h3',
  '.section-heading',
  'main',
  'article',
  '#main',
  '#content',
  '.main',
  '.content',
  '.post',
  '.article',
  '[role="main"]',
  '.main-content',
];

/* ──────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────────── */
interface UrlInputProps {
  onApiResult: (result: ApiResult, error: string | null) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function UrlInput({ onApiResult, onLoadingChange }: UrlInputProps) {
  /* ———————————————————————————————————————————
     Simplified state management with nuqs + utilities
  ——————————————————————————————————————————— */
  const { url, setUrl, query, setQuery, limit, setLimit, endpoint, action, getApiPayload, params } = useStudioParams();

  /* ———————————————————————————————————————————
     Loading state
  ——————————————————————————————————————————— */
  const [loading, startTransition] = useTransition();

  /* ———————————————————————————————————————————
     Notify parent about loading changes
  ——————————————————————————————————————————— */
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  /* ———————————————————————————————————————————
     Helpers to update URL state from inputs
  ——————————————————————————————————————————— */
  const onUrlChange = (v: string) => setUrl(v.trim() === '' ? null : v);
  const onQueryChange = (v: string) => setQuery(v.trim() === '' ? null : v);
  const onLimitChange = (v: string) => {
    if (v.trim() === '') {
      setLimit(null);
    } else {
      const n = Number(v);
      if (!Number.isNaN(n) && n > 0) setLimit(n);
    }
  };

  /* ———————————————————————————————————————————
     Main action handler - much simpler now!
  ——————————————————————————————————————————— */
  const handleApiCall = async () => {
    startTransition(async () => {
      try {
        // Build API payload using utility function (includes schema validation)
        const { action: actionKey, payload, error } = getApiPayload();

        if (error) {
          throw new Error(error);
        }

        // Route to appropriate API call based on action
        switch (actionKey) {
          case 'search/web': {
            const res = await studioApi.search(payload as SearchRequest);
            if (res?.success && res.data?.results) {
              const transformed = {
                results: res.data.results,
                totalResults: res.data.metadata.totalResults,
                searchTime: res.data.metadata.searchTime,
                sources: res.data.metadata.sources,
              };
              onApiResult(transformed, null);
            } else {
              throw new Error('Search failed');
            }
            break;
          }

          case 'scrape/elements': {
            const scrapeRes = await studioApi.scrape(payload as ScrapeRequest);
            const results: any[] = [];

            if (scrapeRes?.success && scrapeRes.data?.elements) {
              const transformed = {
                elements: scrapeRes.data.elements.map((el: any) => {
                  if ('results' in el) {
                    return {
                      selector: el.selector,
                      results: el.results,
                    };
                  }
                  // Legacy/CF-API shape – "data" field
                  const dataField = (el as any).data;
                  return {
                    selector: el.selector,
                    results: Array.isArray(dataField) ? dataField : dataField ? [dataField] : [],
                  };
                }),
              };

              const onlyMainContent = params.onlyMainContent ?? false;
              const finalData = onlyMainContent ? filterMainContent(transformed) : transformed;
              results.push({ type: 'elements', data: finalData });
            }

            // Handle additional data requests for elements action
            const includeMarkdown = params.includeMarkdown ?? false;

            if (includeMarkdown) {
              const md = await studioApi.markdown({ url: (payload as ScrapeRequest).url });
              if (md?.success && md.data?.markdown) {
                results.push({ type: 'markdown', data: md.data.markdown });
              }
            }

            if (results.length === 0) throw new Error('Failed to scrape elements: No data received');
            if (results.length === 1) onApiResult(results[0].data, null);
            else onApiResult({ combinedResults: results }, null);
            break;
          }

          case 'scrape/markdown': {
            const res = await studioApi.markdown(payload as MarkdownRequest);
            if (res?.success && res.data?.markdown) {
              onApiResult(res.data.markdown, null);
            } else {
              throw new Error('Failed to extract markdown');
            }
            break;
          }

          case 'scrape/html': {
            const res = await studioApi.content(payload as ContentRequest);
            if (res?.success && res.data?.content) {
              onApiResult(res.data.content, null);
            } else {
              throw new Error('Failed to fetch HTML content');
            }
            break;
          }

          case 'scrape/links': {
            const res = await studioApi.links(payload as LinksRequest);
            if (res?.success && res.data?.links) {
              onApiResult(res.data.links, null);
            } else {
              throw new Error('Failed to retrieve links');
            }
            break;
          }

          case 'visual/screenshot': {
            const res = await studioApi.screenshot(payload as ScreenshotRequest);
            if (res?.success && res.data?.image) {
              const format = params.format ?? 'png';
              onApiResult({ imageUrl: `data:image/${format};base64,${res.data.image}` }, null);
            } else {
              throw new Error('Failed to get screenshot');
            }
            break;
          }

          case 'structured/json': {
            const res = await studioApi.jsonExtraction(payload as JsonExtractionRequest);
            if (res) {
              onApiResult(res, null);
            } else {
              throw new Error('Failed to extract JSON');
            }
            break;
          }

          default:
            onApiResult({ message: `${action} operation completed successfully` }, null);
        }
      } catch (err: any) {
        console.error('API call error:', err);
        onApiResult(null, err?.message || 'An error occurred during the API call');
      }
    });
  };

  /* ———————————————————————————————————————————
     Render
  ——————————————————————————————————————————— */
  if (endpoint === 'search') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="search-query" className="text-base font-medium">
              Search Query
            </Label>
            <Input
              id="search-query"
              value={query ?? ''}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Enter your search terms..."
              className="text-base h-11"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApiCall();
                }
              }}
            />
          </div>

          <div className="flex flex-col">
            <Label htmlFor="search-limit" className="text-base font-medium">
              Results
            </Label>
            <div className="flex space-x-2">
              <Input
                id="search-limit"
                type="number"
                value={limit?.toString() ?? ''}
                onChange={(e) => onLimitChange(e.target.value)}
                placeholder="15"
                min="1"
                max="50"
                className="text-base h-11"
              />
              <Button
                onClick={handleApiCall}
                type="button"
                className="h-11 px-6"
                disabled={loading || !(query ?? '').trim()}
              >
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="url-input" className="text-base font-medium">
        URL
      </Label>
      <div className="flex space-x-2">
        <Input
          id="url-input"
          value={url ?? ''}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 text-base h-11"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApiCall();
            }
          }}
        />
        <Button onClick={handleApiCall} type="button" className="h-11 px-6" disabled={loading}>
          {loading ? 'Loading...' : 'Run'}
        </Button>
      </div>
    </div>
  );
}
