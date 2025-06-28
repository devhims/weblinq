'use client';

import { Label } from '@/components/ui/label';
import { Globe, Clock, Search } from 'lucide-react';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/badge';
import { SearchResult, SearchMetadata, SearchResponse } from '../types';

interface SearchResultDisplayProps {
  result: SearchResponse;
}

export function SearchResultDisplay({ result }: SearchResultDisplayProps) {
  console.log('SearchResultDisplay received:', result);

  // Extract data with fallbacks for legacy format (score no longer included)
  const results = result?.results || [];
  const metadata = result?.metadata;

  const totalResults = metadata?.totalResults ?? result?.totalResults ?? 0;
  const searchTime = metadata?.searchTime ?? result?.searchTime ?? 0;
  const sources = metadata?.sources ?? result?.sources ?? [];
  const query = metadata?.query ?? '';
  const debug = metadata?.debug;

  // Get source icons and colors
  const getSourceInfo = (source: string) => {
    switch (source) {
      case 'duckduckgo':
        return { icon: '🦆', color: 'bg-orange-100 text-orange-800 border-orange-200' };
      case 'startpage':
        return { icon: '🔍', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'bing':
        return { icon: '🔵', color: 'bg-green-100 text-green-800 border-green-200' };
      default:
        return { icon: '🌐', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  // Format search time
  const formatSearchTime = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
  };

  return (
    <div className="bg-card rounded-md border h-full w-full relative flex flex-col">
      {/* Header with search stats - extends to edges */}
      <div className="flex items-center justify-between p-4 pb-2">
        <div className="flex items-baseline gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            <Label className="font-medium text-base">
              {totalResults} results for &quot;{query}&quot;
            </Label>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatSearchTime(searchTime)}</span>
          </div>
        </div>
        <CopyButton content={result} />
      </div>

      {/* Main content area with padding */}
      <div className="px-4 pb-4 flex-1 overflow-y-auto">
        {/* Sources and debug info */}
        {sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Sources:</span>
            {sources.map((source) => {
              const sourceInfo = getSourceInfo(source);
              const engineDebug = debug?.engines?.[source];

              return (
                <Badge
                  key={source}
                  variant="outline"
                  className={`${sourceInfo.color} text-xs`}
                  title={engineDebug ? `${engineDebug.count} results in ${engineDebug.searchTime}ms` : undefined}
                >
                  <span className="mr-1">{sourceInfo.icon}</span>
                  {source}
                  {engineDebug && <span className="ml-1 opacity-75">({engineDebug.count})</span>}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Debug stats for development */}
        {debug && (
          <div className="mb-4 p-3 bg-muted/30 rounded-md border border-border/50">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Raw: {debug.deduplicationStats?.rawResults ?? 'N/A'}</span>
              <span>Unique: {debug.deduplicationStats?.uniqueResults ?? 'N/A'}</span>
              <span>Final: {debug.deduplicationStats?.finalResults ?? 'N/A'}</span>
              {/* Score-based debug metrics removed */}
            </div>
          </div>
        )}

        {/* Search results */}
        <div className="space-y-4">
          {results.length > 0 ? (
            results.map((searchResult, index) => {
              const sourceInfo = getSourceInfo(searchResult.source);

              return (
                <div key={index} className="border-b border-border pb-4 last:border-b-0">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-blue-600 hover:underline flex-1 mr-2">
                      <a
                        href={searchResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base line-clamp-2"
                      >
                        {searchResult.title || 'Untitled'}
                      </a>
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Score badge removed */}
                      <Badge variant="outline" className={`${sourceInfo.color} text-xs`}>
                        <span className="mr-1">{sourceInfo.icon}</span>
                        {searchResult.source}
                      </Badge>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground mb-2 line-clamp-3">
                    {searchResult.snippet || 'No description available'}
                  </p>

                  <div className="flex items-center text-xs text-muted-foreground">
                    <Globe className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="break-all">{searchResult.url}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-lg font-medium mb-1">No search results found</p>
              <p className="text-muted-foreground text-sm">Try adjusting your search query or check your spelling</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
