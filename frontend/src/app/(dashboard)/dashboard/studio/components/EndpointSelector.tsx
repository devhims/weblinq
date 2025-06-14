'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { ApiEndpoint, ApiSubAction } from '../types';
import { Button } from '@/components/ui/button';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

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

interface EndpointSelectorProps {
  endpoints: ApiEndpoint[];
  children?: React.ReactNode;
}

export function EndpointSelector({
  endpoints,
  children,
}: EndpointSelectorProps) {
  // Use URL search params for state
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Get state from URL params
  const selectedEndpoint = searchParams.get('endpoint') || 'scrape';
  const selectedAction = searchParams.get('action') || 'markdown';

  // Find the current endpoint object
  const currentEndpoint = endpoints.find((e) => e.id === selectedEndpoint);

  // Get relevant params for current endpoint/action
  const getRelevantParams = (endpoint: string, action: string | undefined) => {
    if (!endpoint) return [];
    const key = action ? `${endpoint}:${action}` : endpoint;
    return ENDPOINT_ACTION_PARAMS[key] || ['url', 'endpoint', 'action'];
  };

  // Update URL search params
  const updateSearchParams = (newParams: Record<string, string>) => {
    const params = new URLSearchParams();

    // Get list of relevant params for this endpoint/action
    const relevantParams = getRelevantParams(
      newParams.endpoint || selectedEndpoint,
      newParams.action || selectedAction
    );

    // First, add any existing relevant params
    relevantParams.forEach((param) => {
      const value = searchParams.get(param);
      if (value) {
        params.set(param, value);
      }
    });

    // Then override with new params
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Clean up: only keep relevant params
    Array.from(params.keys()).forEach((key) => {
      if (!relevantParams.includes(key)) {
        params.delete(key);
      }
    });

    router.replace(`${pathname}?${params.toString()}`);
  };

  // Handle main endpoint (tab) selection
  const handleEndpointChange = (value: string) => {
    // If there are sub-actions, select the first one by default
    const endpoint = endpoints.find((e) => e.id === value);
    if (endpoint?.subActions && endpoint.subActions.length > 0) {
      updateSearchParams({
        endpoint: value,
        action: endpoint.subActions[0].id,
      });
    } else {
      updateSearchParams({
        endpoint: value,
        action: value,
      });
    }
  };

  // Handle sub-action selection
  const handleSubActionSelect = (actionId: string) => {
    updateSearchParams({
      endpoint: selectedEndpoint,
      action: actionId,
    });
  };

  return (
    <div className='w-full overflow-hidden'>
      <Label className='text-lg font-medium'>Choose API Endpoint</Label>
      <Tabs
        value={selectedEndpoint}
        onValueChange={handleEndpointChange}
        className='mt-2 w-full'
      >
        <TabsList className='grid grid-cols-1 md:grid-cols-4 p-1 h-auto bg-muted/60'>
          {endpoints.map((endpoint) => (
            <TabsTrigger
              key={endpoint.id}
              value={endpoint.id}
              className={`flex items-center justify-center text-base py-3 px-4 h-auto transition-all duration-200
                data-[state=active]:bg-primary/90 data-[state=active]:text-white data-[state=active]:font-bold
                data-[state=active]:shadow-lg data-[state=active]:border-b-4 data-[state=active]:border-primary
                data-[state=active]:scale-105
              `}
            >
              <endpoint.icon className='h-5 w-5 mr-2.5' />
              <span className='font-medium'>{endpoint.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className='mt-4 w-full overflow-hidden'>
          {/* Display sub-actions if available */}
          {currentEndpoint?.subActions &&
            currentEndpoint.subActions.length > 1 && (
              <div className='mb-4'>
                <Label className='mb-2 text-lg font-medium'>Action Type</Label>
                <div className='flex flex-wrap gap-2'>
                  {currentEndpoint.subActions.map((subAction) => (
                    <Button
                      key={subAction.id}
                      variant={
                        selectedAction === subAction.id ? 'default' : 'outline'
                      }
                      size='sm'
                      className='text-base py-2 px-4'
                      onClick={() => handleSubActionSelect(subAction.id)}
                    >
                      {subAction.name}
                    </Button>
                  ))}
                </div>
                <p className='text-base text-muted-foreground mt-2'>
                  {currentEndpoint.subActions.find(
                    (sa) => sa.id === selectedAction
                  )?.description || currentEndpoint.description}
                </p>
              </div>
            )}

          {children}
        </div>
      </Tabs>
    </div>
  );
}
