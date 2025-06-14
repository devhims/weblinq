'use client';

import { Label } from '@/components/ui/label';
import { Globe } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckIcon, ClipboardIcon } from 'lucide-react';

// Copy button component
function CopyButton({ content }: { content: any }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy =
      typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='absolute top-3 right-6 z-10 h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/70'
            onClick={handleCopy}
          >
            {copied ? (
              <CheckIcon className='h-4 w-4 text-primary' />
            ) : (
              <ClipboardIcon className='h-4 w-4' />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? 'Copied!' : 'Copy to clipboard'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
    <div className='bg-card rounded-md border overflow-auto h-[400px] w-full relative'>
      <CopyButton content={result} />
      <div className='p-4'>
        <div className='flex items-center mb-3'>
          <Globe className='h-5 w-5 mr-2 text-primary' />
          <Label className='font-medium text-base'>
            Found {totalResults} results in {searchTime}ms
          </Label>
        </div>
        {sources.length > 0 && (
          <p className='text-sm text-muted-foreground mb-4'>
            Sources: {sources.join(', ')}
          </p>
        )}
        <div className='space-y-3'>
          {results.length > 0 ? (
            results.map((searchResult: any, index: number) => (
              <div
                key={index}
                className='border-b border-border pb-3 last:border-b-0'
              >
                <h3 className='font-medium text-blue-600 hover:underline mb-1'>
                  <a
                    href={searchResult.url}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-base'
                  >
                    {searchResult.title || 'Untitled'}
                  </a>
                </h3>
                <p className='text-sm text-muted-foreground mb-1'>
                  {searchResult.snippet || 'No description available'}
                </p>
                <div className='flex items-center text-xs text-muted-foreground'>
                  <span className='mr-2'>
                    Source: {searchResult.source || 'unknown'}
                  </span>
                  <span className='break-all'>{searchResult.url}</span>
                </div>
              </div>
            ))
          ) : (
            <p className='text-muted-foreground text-center py-8'>
              No search results found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
