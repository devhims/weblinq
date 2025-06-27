'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { API_ENDPOINTS } from '../endpoints';
import { type EndpointId, type ActionId } from '../constants';
import { useStudioParams } from '../hooks/useStudioParams';

interface EndpointSelectorProps {
  children?: React.ReactNode;
}

export function EndpointSelector({ children }: EndpointSelectorProps) {
  const { endpoint: selectedEndpoint, action: selectedAction, switchAction } = useStudioParams();

  const currentEndpoint = API_ENDPOINTS.find((e) => e.id === selectedEndpoint);

  // — Handlers —
  const handleEndpointChange = (value: EndpointId) => {
    const ep = API_ENDPOINTS.find((e) => e.id === value);
    const firstAction = ep?.subActions[0]?.id ?? value;
    switchAction(value, firstAction as ActionId);
  };

  const handleSubActionSelect = (actionId: ActionId) => {
    switchAction(selectedEndpoint || 'scrape', actionId);
  };

  return (
    <div className="w-full overflow-hidden">
      <Label className="text-base font-medium">Choose API Endpoint</Label>
      <Tabs
        value={selectedEndpoint}
        onValueChange={(value) => handleEndpointChange(value as EndpointId)}
        className="mt-2 w-full"
      >
        <TabsList className="grid grid-cols-1 md:grid-cols-4 px-2 h-auto bg-muted/60 w-full">
          {API_ENDPOINTS.map((endpoint) => (
            <TabsTrigger
              key={endpoint.id}
              value={endpoint.id}
              className={`flex items-center justify-center text-sm py-2 px-3 h-auto transition-all duration-200
                data-[state=active]:bg-primary/90 data-[state=active]:text-white data-[state=active]:font-bold
                data-[state=active]:shadow-lg data-[state=active]:border-b-4 data-[state=active]:border-primary
                data-[state=active]:scale-105
              `}
            >
              <endpoint.icon className="h-4 w-4 mr-2" />
              <span className="font-medium">{endpoint.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4 w-full overflow-hidden">
          {currentEndpoint?.subActions && currentEndpoint.subActions.length > 1 && (
            <div className="mb-4">
              <Label className="mb-2 text-base font-medium">Action Type</Label>
              <div className="flex flex-wrap gap-2">
                {currentEndpoint.subActions.map((subAction) => (
                  <Button
                    key={subAction.id}
                    variant={selectedAction === subAction.id ? 'default' : 'outline'}
                    size="sm"
                    className="text-sm py-1 px-3"
                    onClick={() => handleSubActionSelect(subAction.id)}
                  >
                    {subAction.name}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {currentEndpoint.subActions.find((sa) => sa.id === selectedAction)?.description ||
                  currentEndpoint.description}
              </p>
            </div>
          )}

          {/* Render advanced options for selected action via children */}
          {children}
        </div>
      </Tabs>
    </div>
  );
}
