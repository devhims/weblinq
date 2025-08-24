/**
 * Search V2 - Uses Weblinq Search API instead of browser-based scraping
 */

/**
 * Input params - keeping same interface as V1 for compatibility
 */
export interface SearchParams {
  query: string;
  limit?: number;
}

/**
 * Weblinq Search API Response Types
 */
interface WeblinqSearchResult {
  id: string;
  title: string;
  url: string;
  text: string;
  favicon: string;
  publishedDate?: string;
}

interface WeblinqSearchResponse {
  requestId: string;
  autopromptString: string;
  autoDate: string;
  results: WeblinqSearchResult[];
  searchTime: number;
}

/**
 * V2 Search Response Types - Updated for Weblinq Search format
 */
export interface SearchV2Success {
  success: true;
  data: {
    results: Array<{
      id: string;
      title: string;
      url: string;
      snippet: string;
      favicon?: string;
      publishedDate?: string;
    }>;
    metadata: {
      query: string;
      totalResults: number;
      searchTime: number;
      timestamp: string;
      requestId?: string;
    };
  };
  creditsCost: number;
}

export interface SearchV2Failure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

export type SearchV2Result = SearchV2Success | SearchV2Failure;

const CREDIT_COST = 1;

/**
 * V2 Search implementation using Weblinq Search API
 * Fast, reliable search without browser overhead
 */
export async function searchV2(env: CloudflareBindings, params: SearchParams): Promise<SearchV2Result> {
  const startTime = Date.now();

  try {
    // Get Weblinq Search API URL from environment
    const weblinqSearchApiUrl = env.WEBLINQ_SEARCH_API_URL;
    if (!weblinqSearchApiUrl) {
      throw new Error('WEBLINQ_SEARCH_API_URL not configured');
    }

    console.log(`🔍 [SearchV2] Starting Weblinq Search for query: "${params.query}"`);

    // Build request URL
    const searchUrl = new URL('/search', weblinqSearchApiUrl);
    searchUrl.searchParams.set('q', params.query);

    // Note: Weblinq Search API doesn't seem to have a limit parameter in the example
    // We truncate results on our end based on the limit parameter (max 20)

    // Make API request
    const response = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'WebLinq-SearchV2/1.0',
        Accept: 'application/json',
        Authorization: `Bearer ${env.WEBLINQ_SEARCH_SECRET}`,
      },
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Weblinq Search API request failed: ${response.status} ${response.statusText}`);
    }

    const apiResponse: WeblinqSearchResponse = await response.json();
    console.log(`✅ [SearchV2] Weblinq Search API responded in ${Date.now() - startTime}ms`);

    // Apply limit if specified (max 20 results)
    const limit = Math.min(params.limit ?? 10, 20);
    const limitedResults = apiResponse.results.slice(0, limit);

    // Transform Weblinq Search results to our format
    const transformedResults = limitedResults.map((result) => ({
      id: result.url, // Use URL as ID
      title: result.title,
      url: result.url,
      snippet: result.text,
      favicon: result.favicon,
      publishedDate: result.publishedDate,
    }));

    const elapsed = Date.now() - startTime;

    console.log(`🎯 [SearchV2] Search completed in ${elapsed}ms, found ${transformedResults.length} results`);

    return {
      success: true,
      data: {
        results: transformedResults,
        metadata: {
          query: params.query,
          totalResults: transformedResults.length,
          searchTime: apiResponse.searchTime,
          timestamp: new Date().toISOString(),
          requestId: apiResponse.requestId,
          //   debug: {
          //     apiSearchTime: apiResponse.searchTime,
          //     totalRequestTime: elapsed,
          //     autopromptString: apiResponse.autopromptString,
          //     autoDate: apiResponse.autoDate,
          //     originalResultsCount: apiResponse.results.length,
          //     limitedResultsCount: transformedResults.length,
          //   },
        },
      },
      creditsCost: CREDIT_COST,
    };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    console.error(`❌ [SearchV2] Search failed after ${elapsed}ms:`, errorMessage);

    return {
      success: false,
      error: { message: `Search failed: ${errorMessage}` },
      creditsCost: 0,
    };
  }
}
