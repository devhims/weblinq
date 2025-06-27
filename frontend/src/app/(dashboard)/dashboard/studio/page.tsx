import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Suspense } from 'react';
import { ApiReference } from './components/ApiReference';
import StudioClientContainer from './components/StudioClientContainer';

export default function StudioPage() {
  return (
    <section className="flex-1 p-2 lg:p-4">
      {/* <h1 className="text-lg lg:text-2xl font-medium mb-4">Studio</h1> */}

      <Card className="mb-6 w-full overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl">Studio</CardTitle>
          <CardDescription className="text-base">
            Experiment with web scraping and data extraction in an interactive interface.
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full overflow-hidden">
          {/* All client-side interaction is encapsulated in this component */}
          <Suspense fallback={<div className="w-full text-center py-8">Loading...</div>}>
            <StudioClientContainer />
          </Suspense>
        </CardContent>
      </Card>

      {/* API Reference Component */}
      <ApiReference />
    </section>
  );
}
