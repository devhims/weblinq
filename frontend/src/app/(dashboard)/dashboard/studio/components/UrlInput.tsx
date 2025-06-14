'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { studioApi } from '@/lib/studio-api';
import { ApiResult } from '../types';
import React from 'react';
import { filterMainContent } from '../utils/mainContent';

interface UrlInputProps {
  onApiResult: (result: ApiResult, error: string | null) => void;
  onLoadingChange?: (loading: boolean) => void;
}

// Common selectors that typically represent main content areas
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

export function UrlInput({ onApiResult, onLoadingChange }: UrlInputProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [loading, startTransition] = useTransition();

  // All state declarations at the top level to avoid hook order issues
  const [localUrl, setLocalUrl] = useState(
    searchParams.get('url') || 'https://example.com'
  );
  const [localQuery, setLocalQuery] = useState(searchParams.get('query') || '');
  const [localLimit, setLocalLimit] = useState(
    searchParams.get('limit') || '15'
  );

  // Get current endpoint to determine what inputs to show
  const selectedEndpoint = searchParams.get('endpoint') || 'scrape';

  // Update parent component about loading state changes
  React.useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(loading);
    }
  }, [loading, onLoadingChange]);

  const updateUrl = (newUrl: string) => {
    setLocalUrl(newUrl);
    const params = new URLSearchParams(searchParams);
    params.set('url', newUrl);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const updateQuery = (newQuery: string) => {
    setLocalQuery(newQuery);
    const params = new URLSearchParams(searchParams);
    if (newQuery) {
      params.set('query', newQuery);
    } else {
      params.delete('query');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const updateLimit = (newLimit: string) => {
    setLocalLimit(newLimit);
    const params = new URLSearchParams(searchParams);
    const numValue = parseInt(newLimit, 10);
    if (!isNaN(numValue) && numValue > 0) {
      params.set('limit', newLimit);
    } else {
      params.delete('limit');
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleApiCall = async () => {
    startTransition(async () => {
      try {
        // Get current endpoint and action from URL
        const selectedEndpoint = searchParams.get('endpoint') || 'scrape';
        const selectedAction = searchParams.get('action') || 'markdown';
        const url = localUrl;

        // Gather parameters based on endpoint/action
        const selector = searchParams.get('selector') || '';
        const elements = selector
          ? selector.split(',').map((s) => ({ selector: s.trim() }))
          : [];
        const onlyMainContent = searchParams.get('onlyMainContent') === 'true';
        const includeMarkdown = searchParams.get('includeMarkdown') === 'true';
        const includeLinks = searchParams.get('includeLinks') === 'true';
        const visibleLinksOnly =
          searchParams.get('visibleLinksOnly') === 'true';

        // Visual params
        const fullPage = searchParams.get('fullPage') !== 'false'; // default true
        const width = searchParams.get('width')
          ? Number(searchParams.get('width'))
          : 1280;
        const height = searchParams.get('height')
          ? Number(searchParams.get('height'))
          : 800;
        const waitTime = searchParams.get('waitTime')
          ? Number(searchParams.get('waitTime'))
          : 0;
        const format = searchParams.get('format') || 'png';
        const quality = searchParams.get('quality')
          ? Number(searchParams.get('quality'))
          : undefined;

        // Structured params
        const jsonPrompt = searchParams.get('jsonPrompt') || '';

        // Handle different endpoints and actions
        if (selectedEndpoint === 'scrape') {
          if (selectedAction === 'elements') {
            let elementsToUse = elements;

            // If no elements are specified and onlyMainContent is true,
            // use all main content selectors
            if (elements.length === 0 && onlyMainContent) {
              elementsToUse = MAIN_CONTENT_SELECTORS.map((selector) => ({
                selector,
              }));
            } else if (elements.length === 0) {
              // Default to h1 if no selectors and not onlyMainContent
              elementsToUse = [{ selector: 'h1' }];
            }

            const scrapePayload = {
              url,
              elements: elementsToUse,
              waitTime: waitTime > 0 ? waitTime : undefined,
            };
            const results: any[] = [];
            const scrapeRes = await studioApi.scrape(scrapePayload);

            if (scrapeRes?.success && scrapeRes.data?.elements) {
              // Transform backend response to frontend format
              const transformedElements = scrapeRes.data.elements.map(
                (element) => ({
                  selector: element.selector,
                  results: Array.isArray(element.data)
                    ? element.data.map((item) => ({
                        html: item.html || '',
                        text: item.text || '',
                        top: item.top || 0,
                        left: item.left || 0,
                        width: item.width || 0,
                        height: item.height || 0,
                        attributes: item.attributes || [],
                      }))
                    : [
                        {
                          html: element.data.html || '',
                          text: element.data.text || '',
                          top: element.data.top || 0,
                          left: element.data.left || 0,
                          width: element.data.width || 0,
                          height: element.data.height || 0,
                          attributes: element.data.attributes || [],
                        },
                      ],
                })
              );

              const frontendFormat = { elements: transformedElements };

              // Apply main content filtering if the option is enabled
              if (onlyMainContent) {
                const filteredResult = filterMainContent(frontendFormat);
                results.push({ type: 'elements', data: filteredResult });
              } else {
                results.push({ type: 'elements', data: frontendFormat });
              }
            }

            if (includeMarkdown) {
              try {
                const markdownRes = await studioApi.markdown({ url });
                if (markdownRes?.success && markdownRes.data?.markdown) {
                  results.push({
                    type: 'markdown',
                    data: markdownRes.data.markdown,
                  });
                }
              } catch (err) {
                console.error('Markdown extraction error:', err);
              }
            }
            if (includeLinks) {
              try {
                const linksRes = await studioApi.links({
                  url,
                  includeExternal: true,
                });
                if (linksRes?.success && linksRes.data?.links) {
                  results.push({ type: 'links', data: linksRes.data.links });
                }
              } catch (err) {
                console.error('Links extraction error:', err);
              }
            }
            if (results.length === 0) {
              throw new Error('Failed to scrape elements: No data received');
            } else if (results.length === 1) {
              onApiResult(results[0].data, null);
            } else {
              const combinedResult = {
                combinedResults: results,
              };
              onApiResult(combinedResult, null);
            }
            return;
          }
          if (selectedAction === 'markdown') {
            const res = await studioApi.markdown({ url });

            if (res?.success && res.data?.markdown) {
              onApiResult(res.data.markdown, null);
            } else {
              throw new Error(
                `Failed to extract markdown: No content received. Response: ${JSON.stringify(
                  res
                )}`
              );
            }
            return;
          }
          if (selectedAction === 'html') {
            const res = await studioApi.content({ url });
            if (res?.success && res.data?.content) {
              onApiResult(res.data.content, null);
            } else {
              throw new Error('Failed to fetch HTML content: No data received');
            }
            return;
          }
          if (selectedAction === 'links') {
            const res = await studioApi.links({
              url,
              includeExternal: true,
            });
            if (res?.success && res.data?.links) {
              onApiResult(res.data.links, null);
            } else {
              throw new Error('Failed to retrieve links: No data received');
            }
            return;
          }
        }
        if (selectedEndpoint === 'visual') {
          if (selectedAction === 'screenshot') {
            const res = await studioApi.screenshot({
              url,
              fullPage,
              width,
              height,
              waitTime,
              format,
              quality: format === 'png' ? undefined : quality,
            });
            if (res?.success && res.data?.image) {
              const newResult = {
                imageUrl: `data:image/${format};base64,${res.data.image}`,
              };
              onApiResult(newResult, null);
            } else {
              throw new Error(
                'Failed to get screenshot: No image data received'
              );
            }
            return;
          }
          if (selectedAction === 'pdf') {
            // Placeholder/mock result for PDF
            const mockResult: ApiResult = {
              fileUrl: 'https://example.com/sample.pdf',
            };
            onApiResult(mockResult, null);
            return;
          }
        }
        if (selectedEndpoint === 'structured') {
          if (selectedAction === 'json') {
            const jsonOptions: {
              url: string;
              schema: Record<string, any>;
              waitTime?: number;
              instructions?: string;
            } = {
              url,
              schema: {}, // Default empty schema
            };
            if (jsonPrompt?.trim()) {
              jsonOptions.instructions = jsonPrompt;
            }
            if (waitTime > 0) {
              jsonOptions.waitTime = waitTime;
            }
            const res = await studioApi.jsonExtraction(jsonOptions);
            if (res) {
              onApiResult(res, null);
            } else {
              throw new Error('Failed to extract JSON: No data received');
            }
            return;
          }
        }
        if (selectedEndpoint === 'search') {
          if (selectedAction === 'web') {
            const query = searchParams.get('query') || '';
            const limit = parseInt(searchParams.get('limit') || '15', 10);

            if (!query.trim()) {
              throw new Error('Search query is required');
            }

            const searchResult = await studioApi.search({ query, limit });

            if (searchResult?.success && searchResult.data?.results) {
              // Transform the response to match what SearchResultDisplay expects
              const transformedResult = {
                results: searchResult.data.results,
                totalResults: searchResult.data.metadata.totalResults,
                searchTime: searchResult.data.metadata.searchTime,
                sources: searchResult.data.metadata.sources,
              };
              onApiResult(transformedResult, null);
            } else {
              throw new Error('Search failed');
            }
            return;
          }
        }
        // fallback
        const mockResult: ApiResult = {
          message: `${selectedAction} operation completed successfully`,
        };
        onApiResult(mockResult, null);
      } catch (err: any) {
        console.error('API call error:', err);
        onApiResult(
          null,
          err?.message || 'An error occurred during the API call'
        );
      }
    });
  };

  // For search endpoint, show search query and limit inputs
  if (selectedEndpoint === 'search') {
    return (
      <div className='space-y-4'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div className='md:col-span-2'>
            <Label htmlFor='search-query' className='text-base font-medium'>
              Search Query
            </Label>
            <Input
              id='search-query'
              value={localQuery}
              onChange={(e) => updateQuery(e.target.value)}
              placeholder='Enter your search terms...'
              className='text-base h-11'
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApiCall();
                }
              }}
            />
          </div>
          <div className='flex flex-col'>
            <Label htmlFor='search-limit' className='text-base font-medium'>
              Results
            </Label>
            <div className='flex space-x-2'>
              <Input
                id='search-limit'
                type='number'
                value={localLimit}
                onChange={(e) => updateLimit(e.target.value)}
                placeholder='15'
                min='1'
                max='50'
                className='text-base h-11'
              />
              <Button
                onClick={handleApiCall}
                type='button'
                className='h-11 px-6'
                disabled={loading || !localQuery.trim()}
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
    <div className='space-y-2'>
      <Label htmlFor='url-input' className='text-base font-medium'>
        URL
      </Label>
      <div className='flex space-x-2'>
        <Input
          id='url-input'
          value={localUrl}
          onChange={(e) => updateUrl(e.target.value)}
          placeholder='https://example.com'
          className='flex-1 text-base h-11'
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApiCall();
            }
          }}
        />
        <Button
          onClick={handleApiCall}
          type='button'
          className='h-11 px-6'
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Run'}
        </Button>
      </div>
    </div>
  );
}
