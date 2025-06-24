'use client';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, Globe } from 'lucide-react';
import { API_ENDPOINTS } from '../endpoints';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

export function ApiReference() {
  const router = useRouter();
  const pathname = usePathname();

  const handleEndpointSelect = (actionId: string) => {
    const params = new URLSearchParams();
    params.set('endpoint', actionId.split(':')[0]);
    params.set('action', actionId.split(':')[1] || actionId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <Card className="w-full overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl">API Reference</CardTitle>
        <CardDescription className="text-base">
          Overview of the available Browser Rendering API endpoints
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full overflow-hidden">
        <Accordion type="single" collapsible className="w-full">
          {API_ENDPOINTS.map((endpoint) => (
            <AccordionItem key={endpoint.id} value={endpoint.id}>
              <AccordionTrigger className="hover:bg-accent/50 px-4 rounded-md text-base">
                <div className="flex items-center">
                  <endpoint.icon className="h-5 w-5 text-primary mr-2 flex-shrink-0" />
                  <h3 className="font-medium text-base">{endpoint.name}</h3>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pl-10 pr-4 pb-4">
                  <p className="text-base text-muted-foreground mb-3">{endpoint.description}</p>

                  {endpoint.subActions && endpoint.subActions.length > 0 ? (
                    <div className="space-y-2">
                      <h4 className="text-base font-medium mb-1">Available Actions:</h4>
                      {endpoint.subActions.map((action) => (
                        <div
                          key={action.id}
                          className="border rounded-md p-3 hover:border-primary/30 hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => handleEndpointSelect(`${endpoint.id}:${action.id}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-base">{action.name}</h5>
                              <p className="text-sm text-muted-foreground">{action.description}</p>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <code className="text-sm text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded mt-2 inline-block">
                            /{action.id}
                          </code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="border rounded-md p-3 hover:border-primary/30 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleEndpointSelect(endpoint.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-medium text-base">{endpoint.name} API</h5>
                          <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <code className="text-sm text-muted-foreground bg-muted/70 px-1.5 py-0.5 rounded mt-2 inline-block">
                        /{endpoint.id}
                      </code>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
      <CardFooter className="bg-card border-t flex justify-between items-center flex-wrap gap-2">
        <p className="text-base text-muted-foreground">
          Use the REST API for simple browser tasks like capturing screenshots or extracting HTML.
        </p>
        <Button variant="outline" size="sm" className="text-base py-2 px-4">
          <Globe className="h-5 w-5 mr-2" />
          API Docs
        </Button>
      </CardFooter>
    </Card>
  );
}
