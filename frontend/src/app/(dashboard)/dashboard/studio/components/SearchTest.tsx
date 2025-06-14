'use client';

import { useState } from 'react';
import { performSearch } from '../search';

export default function SearchTest() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const searchResult = await performSearch(query, 15);
      setResults(searchResult);
    } catch (error) {
      console.error('Search failed:', error);
      setResults({ success: false, error: 'Search failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='w-full max-w-2xl mx-auto p-6 border border-border rounded-lg'>
      <h2 className='text-xl font-semibold mb-4'>Search Test</h2>

      <form onSubmit={handleSearch} className='mb-4'>
        <div className='flex gap-2'>
          <input
            type='text'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Enter search query...'
            className='flex-1 px-3 py-2 border border-border rounded-md'
            disabled={loading}
          />
          <button
            type='submit'
            disabled={loading || !query.trim()}
            className='px-4 py-2 bg-foreground text-background rounded-md hover:bg-foreground/90 disabled:opacity-50'
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {results && (
        <div className='mt-4'>
          {results.success ? (
            <div>
              <p className='text-sm text-muted-foreground mb-2'>
                Found {results.data.totalResults} results in{' '}
                {results.data.searchTime}ms from{' '}
                {results.data.sources.join(', ')}
              </p>
              <div className='space-y-3'>
                {results.data.results.map((result: any, index: number) => (
                  <div key={index} className='border-b border-border pb-2'>
                    <h3 className='font-medium text-blue-600 hover:underline'>
                      <a
                        href={result.url}
                        target='_blank'
                        rel='noopener noreferrer'
                      >
                        {result.title}
                      </a>
                    </h3>
                    <p className='text-sm text-muted-foreground'>
                      {result.snippet}
                    </p>
                    <span className='text-xs text-muted-foreground'>
                      Source: {result.source}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className='text-red-500'>Error: {results.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
