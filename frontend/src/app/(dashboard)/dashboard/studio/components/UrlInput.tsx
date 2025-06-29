'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTransition, useEffect, useState } from 'react';
import React from 'react';
import { Loader2, CircleCheck, X, Play } from 'lucide-react';

import { studioApi } from '@/lib/studio-api';
import type {
  MarkdownRequest,
  ScreenshotRequest,
  ContentRequest,
  LinksRequest,
  ScrapeRequest,
  JsonExtractionRequest,
  SearchRequest,
  PdfRequest,
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
   Types for button state
──────────────────────────────────────────────────────────────── */
type ButtonState = 'idle' | 'loading' | 'success' | 'error';

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
     Loading state and button status
  ——————————————————————————————————————————— */
  const [loading, startTransition] = useTransition();
  const [buttonState, setButtonState] = useState<ButtonState>('idle');

  /* ———————————————————————————————————————————
     Notify parent about loading changes
  ——————————————————————————————————————————— */
  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  /* ———————————————————————————————————————————
     Update button state based on loading
  ——————————————————————————————————————————— */
  useEffect(() => {
    if (loading) {
      setButtonState('loading');
    }
  }, [loading]);

  /* ———————————————————————————————————————————
     Helper to show status briefly then return to idle
  ——————————————————————————————————————————— */
  const showStatusBriefly = (status: 'success' | 'error') => {
    setButtonState(status);
    setTimeout(() => {
      setButtonState('idle');
    }, 1500); // Show status for 1.5 seconds
  };

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
      // Allow any valid number input - validation will be done on submit
      if (!Number.isNaN(n)) setLimit(n);
    }
  };

  /* ———————————————————————————————————————————
     Button content based on state
  ——————————————————————————————————————————— */
  const getButtonContent = (isSearch: boolean = false) => {
    // const baseText = isSearch ? 'Search' : 'Run';

    switch (buttonState) {
      case 'loading':
        return (
          <>
            <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
          </>
        );
      case 'success':
        return (
          <>
            <CircleCheck className="h-3 w-3 sm:h-4 sm:w-4" />
          </>
        );
      case 'error':
        return (
          <>
            <X className="h-3 w-3 sm:h-4 sm:w-4" />
          </>
        );
      default:
        return (
          <>
            <Play className="h-3 w-3 sm:h-4 sm:w-4" />
          </>
        );
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
              // Pass the full response data structure for SearchResultDisplay
              onApiResult(res.data, null);
              showStatusBriefly('success');
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
            showStatusBriefly('success');
            break;
          }

          case 'scrape/markdown': {
            const res = await studioApi.markdown(payload as MarkdownRequest);
            if (res?.success && res.data?.markdown) {
              onApiResult(res.data.markdown, null);
              showStatusBriefly('success');
            } else {
              throw new Error('Failed to extract markdown');
            }
            break;
          }

          case 'scrape/html': {
            const res = await studioApi.content(payload as ContentRequest);
            if (res?.success && res.data?.content) {
              onApiResult(res.data.content, null);
              showStatusBriefly('success');
            } else {
              throw new Error('Failed to fetch HTML content');
            }
            break;
          }

          case 'scrape/links': {
            const res = await studioApi.links(payload as LinksRequest);
            if (res?.success && res.data?.links) {
              onApiResult(res.data.links, null);
              showStatusBriefly('success');
            } else {
              throw new Error('Failed to retrieve links');
            }
            break;
          }

          case 'visual/screenshot': {
            const res = await studioApi.screenshot(payload as ScreenshotRequest);
            if (res?.success && res.data?.image) {
              onApiResult({ image: res.data.image, data: res.data }, null);
              showStatusBriefly('success');
            } else {
              throw new Error('Failed to capture screenshot');
            }
            break;
          }

          case 'visual/pdf': {
            const res = await studioApi.pdf(payload as PdfRequest);
            if (res?.success && res.data?.pdf) {
              onApiResult({ pdf: res.data.pdf, data: res.data }, null);
              showStatusBriefly('success');
            } else {
              throw new Error('Failed to generate PDF');
            }
            break;
          }

          case 'structured/json':
          case 'structured/text': {
            const res = await studioApi.jsonExtraction(payload as JsonExtractionRequest);
            if (res) {
              onApiResult(res, null);
              showStatusBriefly('success');
            } else {
              throw new Error(`Failed to extract ${actionKey === 'structured/text' ? 'text analysis' : 'JSON'}`);
            }
            break;
          }

          default:
            onApiResult({ message: `${action} operation completed successfully` }, null);
            showStatusBriefly('success');
        }
      } catch (err: any) {
        console.error('API call error:', err);
        onApiResult(null, err?.message || 'An error occurred during the API call');
        showStatusBriefly('error');
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
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="search-query" className="text-sm sm:text-base font-medium">
              Search Query
            </Label>
            <Input
              id="search-query"
              value={query ?? ''}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Enter your search terms..."
              className="text-sm sm:text-base h-9"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApiCall();
                }
              }}
            />
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="search-limit" className="text-sm sm:text-base font-medium">
              Results (1-20)
            </Label>
            <div className="flex space-x-2">
              <Input
                id="search-limit"
                type="number"
                value={limit?.toString() ?? ''}
                onChange={(e) => onLimitChange(e.target.value)}
                placeholder="10"
                min="1"
                max="20"
                title="Enter a number between 1 and 20"
                className="text-sm sm:text-base h-9"
              />
              <Button
                onClick={handleApiCall}
                type="button"
                className="h-8 w-12 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm"
                disabled={loading || !(query ?? '').trim()}
              >
                {getButtonContent(false)}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="url-input" className="text-sm sm:text-base font-medium">
        URL
      </Label>
      <div className="flex space-x-2">
        <Input
          id="url-input"
          value={url ?? ''}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 text-sm sm:text-base h-8 sm:h-9"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApiCall();
            }
          }}
        />
        <Button
          onClick={handleApiCall}
          type="button"
          className="h-8 w-12 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm"
          disabled={loading}
        >
          {getButtonContent(false)}
        </Button>
      </div>
    </div>
  );
}
