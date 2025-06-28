'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { UrlInput } from './UrlInput';
import { EndpointSelector } from './EndpointSelector';
import { EndpointActions } from './EndpointActions';
import { ResultDisplay } from './ResultDisplay';
import { ApiResult } from '../types';
import { useStudioParams } from '../hooks/useStudioParams';
import { isVercelPreview, isPreviewAuthenticated } from '@/lib/utils';
import PreviewAuthModal from '@/components/auth/PreviewAuthModal';

// This component is responsible for all client-side interactivity of the Studio
// playground (API calls, loading state, result caching, etc.).
export default function StudioClientContainer() {
  // Pull typed URL parameters via nuqs (see COMMUNICATION_ARCHITECTURE.md)
  const { action: selectedAction } = useStudioParams();

  // Local UI state -----------------------------------------------------------
  const [error, setError] = useState<string | null>(null);
  const [endpointResults, setEndpointResults] = useState<Record<string, ApiResult>>({});
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
      <div className="flex flex-col gap-5 w-full h-full min-h-[800px]">
        {/* URL Input Component – handles API calls and returns data via callback */}
        <div className="flex-shrink-0">
          <UrlInput onApiResult={handleApiResult} onLoadingChange={setLoading} />
        </div>

        {/* Endpoint selector including action-specific parameter inputs */}
        <div className="flex-shrink-0">
          <EndpointSelector>
            <EndpointActions />
          </EndpointSelector>
        </div>

        {/* Results ----------------------------------------------------------- */}
        <div className="w-full flex flex-col min-h-0 flex-1">
          <Label className="text-base font-medium">Result</Label>
          <div className="w-full mt-2 flex-1 min-h-0">
            <ResultDisplay
              loading={loading}
              error={error}
              result={endpointResults[selectedAction] || null}
              selectedEndpoint={selectedAction}
            />
          </div>
        </div>
      </div>

      {/* Preview Authentication Modal */}
      {showPreviewAuth && <PreviewAuthModal onAuthenticated={() => setShowPreviewAuth(false)} />}
    </>
  );
}
