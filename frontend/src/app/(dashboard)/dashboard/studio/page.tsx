import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiReference } from './components/ApiReference';
import StudioClientContainer from './components/StudioClientContainer';

export default function StudioPage() {
  return (
    <div className="w-full overflow-hidden">
      <Card className="mb-6 w-full overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl">Studio</CardTitle>
          <CardDescription className="text-base">
            Experiment with web scraping and data extraction in an interactive interface.
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full overflow-hidden">
          {/* All client-side interaction is encapsulated in this component */}
          <StudioClientContainer />
        </CardContent>
      </Card>
      {/* API Reference Component */}
      <ApiReference />
    </div>
  );
}
