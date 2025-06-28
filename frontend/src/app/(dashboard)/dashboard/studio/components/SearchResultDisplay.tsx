'use client';

import { Label } from '@/components/ui/label';
import { Globe } from 'lucide-react';
import { CopyButton } from '@/components/ui/copy-button';

interface SearchResultDisplayProps {
  result: any;
}

export function SearchResultDisplay({ result }: SearchResultDisplayProps) {
  console.log('SearchResultDisplay received:', result);

  const totalResults = result?.totalResults || 0;
  const searchTime = result?.searchTime || 0;
  const sources = result?.sources || [];
  const results = result?.results || [];

  return (
    <div className="bg-card rounded-md border h-full w-full relative flex flex-col">
      <CopyButton content={result} />
      <div className="p-4 flex-1 overflow-y-auto">
        <div className="flex items-center mb-3">
          <Globe className="h-5 w-5 mr-2 text-primary" />
          <Label className="font-medium text-base">
            Found {totalResults} results in {searchTime}ms
          </Label>
        </div>
        {sources.length > 0 && <p className="text-sm text-muted-foreground mb-4">Sources: {sources.join(', ')}</p>}
        <div className="space-y-3">
          {results.length > 0 ? (
            results.map((searchResult: any, index: number) => (
              <div key={index} className="border-b border-border pb-3 last:border-b-0">
                <h3 className="font-medium text-blue-600 hover:underline mb-1">
                  <a href={searchResult.url} target="_blank" rel="noopener noreferrer" className="text-base">
                    {searchResult.title || 'Untitled'}
                  </a>
                </h3>
                <p className="text-sm text-muted-foreground mb-1">
                  {searchResult.snippet || 'No description available'}
                </p>
                <div className="flex items-center text-xs text-muted-foreground">
                  <span className="mr-2">Source: {searchResult.source || 'unknown'}</span>
                  <span className="break-all">{searchResult.url}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">No search results found</p>
          )}
        </div>
      </div>
    </div>
  );
}
