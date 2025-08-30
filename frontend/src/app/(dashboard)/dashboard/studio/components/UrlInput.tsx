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
  YouTubeCaptionsRequest,
} from '@/lib/studio-api';
import { ApiResult } from '../types';
import { filterMainContent } from '../utils/mainContent';
import { useStudioParams } from '../hooks/useStudioParams';
import { getErrorMessage } from '@/lib/error-utils';

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
  const {
    url,
    setUrl,
    videoId,
    setVideoId,
    query,
    setQuery,
    limit,
    setLimit,
    endpoint,
    action,
    getApiPayload,
    params,
  } = useStudioParams();

  /* ———————————————————————————————————————————
     Loading state and button status
  ——————————————————————————————————————————— */
  const [loading, startTransition] = useTransition();
  const [buttonState, setButtonState] = useState<ButtonState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Debug logging for submitError state changes
  useEffect(() => {
    console.log('submitError state changed:', submitError);
  }, [submitError]);

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
     URL validation function (only called on submit)
  ——————————————————————————————————————————— */
  const validateUrl = (inputUrl: string): string | null => {
    if (!inputUrl.trim()) return 'URL is required'; // Empty URLs are now caught

    try {
      const urlObj = new URL(inputUrl);
      const hostname = urlObj.hostname;

      // Allow local development URLs
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.')
      ) {
        return null;
      }

      // Must contain at least one dot for TLD
      if (!hostname.includes('.')) {
        return 'URL must include a valid domain name with a top-level domain (e.g., .com, .org, etc.)';
      }

      // Must have a valid TLD (at least 2 characters after the last dot)
      const parts = hostname.split('.');
      const tld = parts[parts.length - 1];

      if (tld.length < 2 || !/^[a-zA-Z]+$/.test(tld)) {
        return 'URL must include a valid domain name with a top-level domain (e.g., .com, .org, etc.)';
      }

      return null; // Valid URL
    } catch {
      return 'Please enter a valid URL (e.g., https://example.com)';
    }
  };

  /* ———————————————————————————————————————————
     Clear error when user starts typing again
  ——————————————————————————————————————————— */
  useEffect(() => {
    if (submitError) {
      console.log('Clearing submitError because URL changed'); // Debug log
      setSubmitError(null);
    }
  }, [url]); // Only depend on URL changes, not submitError changes

  // Clear error when YouTube video ID changes
  useEffect(() => {
    if (submitError && endpoint === 'youtube') {
      console.log('Clearing submitError because YouTube video ID changed'); // Debug log
      setSubmitError(null);
    }
  }, [videoId, endpoint]); // Depend on videoId and endpoint changes

  /* ———————————————————————————————————————————
     Helpers to update state from inputs
  ——————————————————————————————————————————— */
  const onUrlChange = (v: string) => setUrl(v.trim() === '' ? null : v);
  const onVideoIdChange = (v: string) => setVideoId(v.trim() === '' ? null : v);
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
     Main action handler - now includes validation on submit
  ——————————————————————————————————————————— */
  const handleApiCall = async () => {
    // Clear any previous submit errors
    setSubmitError(null);

    console.log('handleApiCall called with:', { endpoint, url, action }); // Debug log

    // Validate input before proceeding
    if (endpoint === 'youtube') {
      // For YouTube, validate video ID
      const currentVideoId = videoId || '';
      if (!currentVideoId.trim()) {
        setSubmitError('YouTube Video ID is required');
        showStatusBriefly('error');
        return;
      }
      // Basic YouTube video ID validation (11 characters, alphanumeric + hyphens + underscores)
      const videoIdRegex = /^[a-zA-Z0-9_-]{11}$/;
      if (!videoIdRegex.test(currentVideoId.trim())) {
        setSubmitError('Please enter a valid YouTube video ID (11 characters)');
        showStatusBriefly('error');
        return;
      }
    } else if (endpoint !== 'search') {
      // For other endpoints, validate URL
      const currentUrl = url || '';
      console.log('Validating URL:', currentUrl); // Debug log
      const urlValidationError = validateUrl(currentUrl);
      console.log('Validation result:', urlValidationError); // Debug log

      if (urlValidationError) {
        console.log('URL validation failed:', urlValidationError); // Debug log
        console.log('About to call setSubmitError with:', urlValidationError); // Debug log
        setSubmitError(urlValidationError);
        console.log('setSubmitError called'); // Debug log
        showStatusBriefly('error');
        return; // Stop execution here - don't proceed with API call
      }
    }

    // Only proceed with API call if validation passes
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
                    results: Array.isArray(dataField)
                      ? dataField
                      : dataField
                        ? [dataField]
                        : [],
                  };
                }),
              };

              const onlyMainContent = params.onlyMainContent ?? false;
              const finalData = onlyMainContent
                ? filterMainContent(transformed)
                : transformed;
              results.push({ type: 'elements', data: finalData });
            }

            // Handle additional data requests for elements action
            const includeMarkdown = params.includeMarkdown ?? false;

            if (includeMarkdown) {
              const md = await studioApi.markdown({
                url: (payload as ScrapeRequest).url,
              });
              if (md?.success && md.data?.markdown) {
                results.push({ type: 'markdown', data: md.data.markdown });
              }
            }

            if (results.length === 0)
              throw new Error('Failed to scrape elements: No data received');
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
            const res = await studioApi.screenshot(
              payload as ScreenshotRequest,
            );
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
            const res = await studioApi.jsonExtraction(
              payload as JsonExtractionRequest,
            );
            if (res) {
              onApiResult(res, null);
              showStatusBriefly('success');
            } else {
              throw new Error(
                `Failed to extract ${actionKey === 'structured/text' ? 'text analysis' : 'JSON'}`,
              );
            }
            break;
          }

          case 'youtube/captions': {
            const res = await studioApi.youtubeCaptions(
              payload as YouTubeCaptionsRequest,
            );
            if (res?.success && res.data) {
              onApiResult(res.data, null);
              showStatusBriefly('success');
            } else {
              throw new Error('Failed to extract YouTube captions');
            }
            break;
          }

          default:
            onApiResult(
              { message: `${action} operation completed successfully` },
              null,
            );
            showStatusBriefly('success');
        }
      } catch (err: any) {
        console.error('API call error:', err);

        // Use error utilities to extract clean error message
        const errorMessage = getErrorMessage(err);

        onApiResult(null, errorMessage);
        showStatusBriefly('error');
      }
    });
  };

  /* ———————————————————————————————————————————
     Render
  ——————————————————————————————————————————— */
  if (endpoint === 'search') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label
              htmlFor="search-query"
              className="text-sm sm:text-base font-medium"
            >
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
            <Label
              htmlFor="search-limit"
              className="text-sm sm:text-base font-medium"
            >
              Results (1-10)
            </Label>
            <div className="flex space-x-2">
              <Input
                id="search-limit"
                type="number"
                value={limit?.toString() ?? ''}
                onChange={(e) => onLimitChange(e.target.value)}
                placeholder="10"
                min="1"
                max="10"
                title="Enter a number between 1 and 10"
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

  // Debug logging before render
  console.log('About to render URL input with submitError:', submitError);

  // Special handling for YouTube endpoint
  if (endpoint === 'youtube') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label
              htmlFor="youtube-video-id"
              className="text-sm sm:text-base font-medium"
            >
              YouTube Video ID
            </Label>
            <Input
              id="youtube-video-id"
              value={videoId ?? ''}
              onChange={(e) => onVideoIdChange(e.target.value)}
              placeholder="Enter YouTube video ID (e.g., dQw4w9WgXcQ)"
              className={`text-sm sm:text-base h-9 ${submitError ? 'border-red-500' : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApiCall();
                }
              }}
            />
            {submitError && (
              <p className="text-red-500 text-xs mt-1">{submitError}</p>
            )}
          </div>

          <div className="flex flex-col space-y-2">
            <Label
              htmlFor="youtube-lang"
              className="text-sm sm:text-base font-medium"
            >
              Language (Optional)
            </Label>
            <div className="flex space-x-2">
              <Input
                id="youtube-lang"
                value={query ?? ''}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="en"
                className="text-sm sm:text-base h-9"
              />
              <Button
                onClick={handleApiCall}
                type="button"
                className="h-9 px-4 text-sm"
                disabled={loading || !(videoId ?? '').trim()}
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
      <div className="flex space-x-2">
        <div className="flex-1">
          <Input
            id="url-input"
            value={url ?? ''}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="Enter URL (e.g., https://example.com)"
            className={`flex-1 text-sm sm:text-base h-8 sm:h-9 ${submitError ? 'border-red-500' : ''}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleApiCall();
              }
            }}
          />
          {submitError && (
            <p className="text-red-500 text-xs mt-1">{submitError}</p>
          )}
        </div>
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
