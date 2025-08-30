'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Globe,
  FileText,
  SlidersVerticalIcon,
  Zap,
  Youtube,
} from 'lucide-react';
import { UrlInput } from './UrlInput';
import { EndpointSelector } from './EndpointSelector';
import { EndpointActions } from './EndpointActions';
import { ResultDisplay } from './ResultDisplay';
import { ApiResult } from '../types';
import { useStudioParams } from '../hooks/useStudioParams';
import { isVercelPreview, isPreviewAuthenticated } from '@/lib/utils';
import PreviewAuthModal from '@/components/auth/PreviewAuthModal';
import { Badge } from '@/components/ui/badge';

// This component is responsible for all client-side interactivity of the Studio
// playground (API calls, loading state, result caching, etc.).
export default function StudioClientContainer() {
  // Pull typed URL parameters via nuqs (see COMMUNICATION_ARCHITECTURE.md)
  const { action: selectedAction, endpoint } = useStudioParams();

  // Local UI state -----------------------------------------------------------
  const [error, setError] = useState<string | null>(null);
  const [endpointResults, setEndpointResults] = useState<
    Record<string, ApiResult>
  >({});
  const [loading, setLoading] = useState(false);
  const [showPreviewAuth, setShowPreviewAuth] = useState(false);

  // Check if we need to show preview authentication modal
  useEffect(() => {
    if (isVercelPreview() && !isPreviewAuthenticated()) {
      setShowPreviewAuth(true);
    }
  }, []);

  // Handler passed to UrlInput to receive results from API calls
  const handleApiResult = (apiResult: ApiResult, apiError: string | null) => {
    setError(apiError);

    if (apiResult) {
      setEndpointResults((prev) => ({
        ...prev,
        [selectedAction]: apiResult,
      }));
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6 w-full">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {endpoint === 'youtube' ? (
                <Youtube className="h-5 w-5" />
              ) : endpoint === 'search' ? (
                <Globe className="h-5 w-5" />
              ) : (
                <Globe className="h-5 w-5" />
              )}
              {endpoint === 'youtube' || endpoint === 'search'
                ? ''
                : 'URL Input'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UrlInput
              onApiResult={handleApiResult}
              onLoadingChange={setLoading}
            />
          </CardContent>
        </Card>

        {/* Endpoint Configuration Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <SlidersVerticalIcon className="h-5 w-5" />
              Endpoint Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EndpointSelector>
              <EndpointActions />
            </EndpointSelector>
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Result{' '}
              {endpoint === 'structured' && (
                <Badge variant="outline" className="text-primary bg-primary/10">
                  <Zap className="h-5 w-5" /> AI Powered
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResultDisplay
              loading={loading}
              error={error}
              result={endpointResults[selectedAction] || null}
              selectedEndpoint={selectedAction}
            />
          </CardContent>
        </Card>
      </div>

      {/* Preview Authentication Modal */}
      {showPreviewAuth && (
        <PreviewAuthModal onAuthenticated={() => setShowPreviewAuth(false)} />
      )}
    </>
  );
}
