'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { API_ENDPOINTS, ApiResult } from '../types';
import { UrlInput } from './UrlInput';
import { EndpointSelector } from './EndpointSelector';
import { EndpointActions } from './EndpointActions';
import { ResultDisplay } from './ResultDisplay';
import { ApiReference } from './ApiReference';
import { useSearchParams } from 'next/navigation';
import React from 'react';

// Define which search params are relevant for each endpoint/action
const ENDPOINT_ACTION_PARAMS: Record<string, string[]> = {
  // scrape actions
  'scrape:elements': [
    'url',
    'endpoint',
    'action',
    'selector',
    'onlyMainContent',
    'includeMarkdown',
    'includeLinks',
    'visibleLinksOnly',
  ],
  'scrape:markdown': ['url', 'endpoint', 'action'],
  'scrape:html': ['url', 'endpoint', 'action'],
  'scrape:links': ['url', 'endpoint', 'action', 'visibleLinksOnly'],
  // visual actions
  'visual:screenshot': [
    'url',
    'endpoint',
    'action',
    'fullPage',
    'width',
    'height',
    'waitTime',
    'format',
    'quality',
  ],
  'visual:pdf': ['url', 'endpoint', 'action'],
  // structured actions
  'structured:json': ['url', 'endpoint', 'action', 'jsonPrompt', 'waitTime'],
  // search actions
  'search:web': ['endpoint', 'action', 'query', 'limit'],
};

function getRelevantParams(endpoint: string, action: string | undefined) {
  if (!endpoint) return [];
  const key = action ? `${endpoint}:${action}` : endpoint;
  return ENDPOINT_ACTION_PARAMS[key] || ['url', 'endpoint', 'action'];
}

export default function PlaygroundContainer() {
  // Use URL search params for state
  const searchParams = useSearchParams();

  // State
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult>(null);
  const [endpointResults, setEndpointResults] = useState<
    Record<string, ApiResult>
  >({});
  const [loading, setLoading] = useState(false);

  // Get state from URL params
  const selectedAction = searchParams.get('action') || 'markdown';

  // Handle API results
  const handleApiResult = (apiResult: ApiResult, apiError: string | null) => {
    setResult(apiResult);
    setError(apiError);

    // Store result in endpointResults to preserve state between tab switches
    if (apiResult) {
      setEndpointResults((prev) => ({
        ...prev,
        [selectedAction]: apiResult,
      }));
    }
  };

  return (
    <div className='w-full overflow-hidden'>
      <Card className='mb-6 w-full overflow-hidden'>
        <CardHeader className='pb-3'>
          <CardTitle className='text-2xl'>Studio</CardTitle>
          <CardDescription className='text-base'>
            Experiment with web scraping and data extraction in an interactive
            interface.
          </CardDescription>
        </CardHeader>
        <CardContent className='w-full overflow-hidden'>
          <div className='grid gap-5 w-full'>
            {/* URL Input Component - Now handles API calls internally */}
            <UrlInput
              onApiResult={handleApiResult}
              onLoadingChange={setLoading}
            />

            {/* Endpoint Selector Component */}
            <EndpointSelector endpoints={API_ENDPOINTS}>
              {/* Endpoint Options Component */}
              <EndpointActions />
            </EndpointSelector>

            <div className='w-full overflow-hidden'>
              <Label className='text-lg font-medium'>Result</Label>
              <div className='w-full overflow-hidden mt-2'>
                {/* Result Display Component */}
                <ResultDisplay
                  loading={loading}
                  error={error}
                  result={endpointResults[selectedAction] || null}
                  selectedEndpoint={selectedAction}
                  fullPage={true}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* API Reference Component */}
      <ApiReference endpoints={API_ENDPOINTS} />
    </div>
  );
}
