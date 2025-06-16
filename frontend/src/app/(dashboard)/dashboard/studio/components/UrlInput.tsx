'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { useQueryState, parseAsInteger } from 'nuqs';

import {
  useSearchParams, // still used for many read-only flags
} from 'next/navigation';

import { useTransition, useEffect } from 'react';
import React from 'react';

import { studioApi } from '@/lib/studio-api';
import { ApiResult } from '../types';
import { filterMainContent } from '../utils/mainContent';

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
     URL-backed state (nuqs)
  ——————————————————————————————————————————— */
  const [url, setUrl] = useQueryState('url', { defaultValue: 'https://example.com' });
  const [query, setQuery] = useQueryState('query', { defaultValue: '' });
  const [limit, setLimit] = useQueryState('limit', parseAsInteger.withDefault(15));

  /* ———————————————————————————————————————————
     Other react state
  ——————————————————————————————————————————— */
  const [loading, startTransition] = useTransition();

  /* ———————————————————————————————————————————
     Read-only flags (still via useSearchParams)
  ——————————————————————————————————————————— */
  const searchParams = useSearchParams();
  const selectedEndpoint = searchParams.get('endpoint') || 'scrape';

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
     Main action handler
  ——————————————————————————————————————————— */
  const handleApiCall = async () => {
    startTransition(async () => {
      try {
        /* pull frequently-used flags fresh each time */
        const endpoint = searchParams.get('endpoint') || 'scrape';
        const action = searchParams.get('action') || 'markdown';

        const currentUrl = url ?? '';
        const selectorRaw = searchParams.get('selector') || '';
        const elements = selectorRaw ? selectorRaw.split(',').map((s) => ({ selector: s.trim() })) : [];

        /* shared visual params */
        const fullPage = searchParams.get('fullPage') === 'true';
        const waitTime = searchParams.get('waitTime') ? Number(searchParams.get('waitTime')) : 0;
        const width = searchParams.get('width') ? Number(searchParams.get('width')) : 1920;
        const height = searchParams.get('height') ? Number(searchParams.get('height')) : 1080;
        const format = searchParams.get('format') || 'png';
        const quality = searchParams.get('quality') ? Number(searchParams.get('quality')) : undefined;
        const mobile = searchParams.get('mobile') === 'true';
        const mobileViewport = mobile
          ? { width: 390, height: 844, deviceScaleFactor: 3, hasTouch: true, isMobile: true }
          : undefined;

        /* scrape-specific flags */
        const onlyMainContent = searchParams.get('onlyMainContent') === 'true';
        const includeMarkdown = searchParams.get('includeMarkdown') === 'true';
        const includeLinks = searchParams.get('includeLinks') === 'true';
        const visibleLinksOnly = searchParams.get('visibleLinksOnly') === 'true'; // eslint-disable-line @typescript-eslint/no-unused-vars

        /* structured */
        const jsonPrompt = searchParams.get('jsonPrompt') || '';

        /* search */
        const currentQuery = query ?? '';
        const currentLimit = limit;

        /* — Endpoint router — */
        if (endpoint === 'search' && action === 'web') {
          if (!currentQuery.trim()) throw new Error('Search query is required');
          const res = await studioApi.search({ query: currentQuery, limit: currentLimit });
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
          return;
        }

        if (endpoint === 'scrape') {
          if (action === 'elements') {
            let elementsToUse = elements;
            if (elements.length === 0 && onlyMainContent) {
              elementsToUse = MAIN_CONTENT_SELECTORS.map((sel) => ({ selector: sel }));
            } else if (elements.length === 0) {
              elementsToUse = [{ selector: 'h1' }];
            }

            const scrapeRes = await studioApi.scrape({
              url: currentUrl,
              elements: elementsToUse,
              waitTime: waitTime > 0 ? waitTime : undefined,
            });

            const results: any[] = [];

            if (scrapeRes?.success && scrapeRes.data?.elements) {
              const transformed = {
                elements: scrapeRes.data.elements.map((el) => ({
                  selector: el.selector,
                  results: Array.isArray(el.data) ? el.data : [el.data],
                })),
              };

              const finalData = onlyMainContent ? filterMainContent(transformed) : transformed;

              results.push({ type: 'elements', data: finalData });
            }

            if (includeMarkdown) {
              const md = await studioApi.markdown({ url: currentUrl });
              if (md?.success && md.data?.markdown) results.push({ type: 'markdown', data: md.data.markdown });
            }

            if (includeLinks) {
              const links = await studioApi.links({ url: currentUrl, includeExternal: true });
              if (links?.success && links.data?.links) results.push({ type: 'links', data: links.data.links });
            }

            if (results.length === 0) throw new Error('Failed to scrape elements: No data received');
            if (results.length === 1) onApiResult(results[0].data, null);
            else onApiResult({ combinedResults: results }, null);

            return;
          }

          if (action === 'markdown') {
            const res = await studioApi.markdown({ url: currentUrl });
            if (res?.success && res.data?.markdown) onApiResult(res.data.markdown, null);
            else throw new Error('Failed to extract markdown');
            return;
          }

          if (action === 'html') {
            const res = await studioApi.content({ url: currentUrl });
            if (res?.success && res.data?.content) onApiResult(res.data.content, null);
            else throw new Error('Failed to fetch HTML content');
            return;
          }

          if (action === 'links') {
            const res = await studioApi.links({ url: currentUrl, includeExternal: true });
            if (res?.success && res.data?.links) onApiResult(res.data.links, null);
            else throw new Error('Failed to retrieve links');
            return;
          }
        }

        if (endpoint === 'visual' && action === 'screenshot') {
          const res = await studioApi.screenshot({
            url: currentUrl,
            viewport: mobileViewport ?? { width, height, deviceScaleFactor: 1 },
            screenshotOptions: {
              fullPage,
              type: format as 'png' | 'jpeg' | 'webp',
              quality: format === 'png' ? undefined : quality,
            },
          });
          if (res?.success && res.data?.image) {
            onApiResult({ imageUrl: `data:image/${format};base64,${res.data.image}` }, null);
          } else {
            throw new Error('Failed to get screenshot');
          }
          return;
        }

        if (endpoint === 'structured' && action === 'json') {
          const res = await studioApi.jsonExtraction({
            url: currentUrl,
            schema: {},
            instructions: jsonPrompt || undefined,
            waitTime: waitTime > 0 ? waitTime : undefined,
          });
          if (res) onApiResult(res, null);
          else throw new Error('Failed to extract JSON');
          return;
        }

        /* fallback mock */
        onApiResult({ message: `${action} operation completed successfully` }, null);
      } catch (err: any) {
        console.error('API call error:', err);
        onApiResult(null, err?.message || 'An error occurred during the API call');
      }
    });
  };

  /* ———————————————————————————————————————————
     Render
  ——————————————————————————————————————————— */
  if (selectedEndpoint === 'search') {
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
