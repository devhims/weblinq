'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { UrlInput } from './UrlInput';
import { EndpointSelector } from './EndpointSelector';
import { EndpointActions } from './EndpointActions';
import { ResultDisplay } from './ResultDisplay';
import { ApiResult } from '../types';
import { useStudioParams } from '../hooks/useStudioParams';

// This component is responsible for all client-side interactivity of the Studio
// playground (API calls, loading state, result caching, etc.).
export default function StudioClientContainer() {
  // Pull typed URL parameters via nuqs (see COMMUNICATION_ARCHITECTURE.md)
  const { action: selectedAction } = useStudioParams();

  // Local UI state -----------------------------------------------------------
  const [error, setError] = useState<string | null>(null);
  const [endpointResults, setEndpointResults] = useState<Record<string, ApiResult>>({});
  const [loading, setLoading] = useState(false);

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
    <div className="grid gap-5 w-full">
      {/* URL Input Component – handles API calls and returns data via callback */}
      <UrlInput onApiResult={handleApiResult} onLoadingChange={setLoading} />

      {/* Endpoint selector including action-specific parameter inputs */}
      <EndpointSelector>
        <EndpointActions />
      </EndpointSelector>

      {/* Results ----------------------------------------------------------- */}
      <div className="w-full overflow-hidden">
        <Label className="text-lg font-medium">Result</Label>
        <div className="w-full overflow-hidden mt-2">
          <ResultDisplay
            loading={loading}
            error={error}
            result={endpointResults[selectedAction] || null}
            selectedEndpoint={selectedAction}
          />
        </div>
      </div>
    </div>
  );
}
