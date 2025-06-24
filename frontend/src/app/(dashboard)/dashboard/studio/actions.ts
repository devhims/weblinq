'use server';

import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { checkAndDeductCredits } from '@/lib/payments/actions';
import { headers } from 'next/headers';

// Get environment variables
const apiToken = process.env['CLOUDFLARE_API_TOKEN'];
const accountId = process.env['CLOUDFLARE_ACCOUNT_ID'];

if (!apiToken || !accountId) {
  throw new Error(
    'Cloudflare API credentials missing: Please set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in your .env file.',
  );
}

// Base URL for Cloudflare API
const BASE_URL = 'https://api.cloudflare.com/client/v4';

// Type definitions for responses
type JsonExtractionResult = {
  [key: string]: any;
  scrape_id?: string;
};

// Credit costs configuration - easily adjustable for future changes
const CREDIT_COSTS = {
  screenshot: 1,
  markdown: 1,
  json_extraction: 1,
  scrape_content: 1,
  scrape_elements: 1,
  scrape_links: 1,
} as const;

// Helper function to check authentication and credits
async function checkCreditsAndAuth(operation: keyof typeof CREDIT_COSTS, metadata?: any) {
  // Get current session
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error('Authentication required to use studio features');
  }

  const creditsRequired = CREDIT_COSTS[operation];

  // Check and deduct credits
  const creditResult = await checkAndDeductCredits(operation, creditsRequired, metadata);

  return {
    userId: session.user.id,
    remainingCredits: creditResult.remainingCredits,
    creditsUsed: creditsRequired,
  };
}

// Default JSON schema for webpage extraction has been moved to src/lib/cloudflare/schemas.ts

/**
 * Take a screenshot of a webpage using Cloudflare Browser Rendering API
 */
export async function getScreenshot({
  url,
  fullPage = false,
  width = 1280,
  height = 800,
  waitTime = 0,
  format = 'png',
  quality = 80,
}: {
  url: string;
  fullPage?: boolean;
  width?: number;
  height?: number;
  waitTime?: number;
  format?: string;
  quality?: number;
}) {
  // Check credits first (full page screenshots cost more)
  const creditsRequired = fullPage ? 2 : 1;
  await checkCreditsAndAuth('screenshot', {
    url,
    fullPage,
    format,
    timestamp: new Date().toISOString(),
  });

  const payload: any = {
    url,
    screenshotOptions: {
      fullPage,
      type: format,
      quality: format === 'png' ? undefined : quality,
    },
    viewport: {
      width,
      height,
    },
    gotoOptions: {
      waitUntil: 'networkidle0',
      timeout: 45000,
    },
  };

  if (waitTime > 0) {
    payload.waitFor = waitTime;
  }

  console.log('Sending request to Cloudflare API:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(`${BASE_URL}/accounts/${accountId}/browser-rendering/screenshot`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloudflare API error:', errorText);
      throw new Error(`Cloudflare API returned ${response.status}: ${errorText}`);
    }

    // Check content type to handle different response formats
    const contentType = response.headers.get('content-type');
    console.log('Response content type:', contentType);

    if (contentType?.includes('application/json')) {
      // Handle JSON response
      const jsonData = await response.json();
      console.log('JSON response received:', JSON.stringify(jsonData, null, 2));

      if (!jsonData.success) {
        throw new Error(`Screenshot failed: ${JSON.stringify(jsonData.errors)}`);
      }

      // If JSON response contains base64 image
      if (jsonData.result) {
        return { base64: jsonData.result };
      }
    }

    // Handle binary response (image data)
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return { base64: buffer.toString('base64') };
  } catch (error) {
    console.error('Screenshot error:', error);
    throw error;
  }
}

/**
 * Extract markdown from a webpage using Cloudflare Browser Rendering API
 */
export async function getMarkdown({ url }: { url: string }) {
  // Check credits first
  await checkCreditsAndAuth('markdown', {
    url,
    timestamp: new Date().toISOString(),
  });

  try {
    const response = await fetch(`${BASE_URL}/accounts/${accountId}/browser-rendering/markdown`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Markdown extraction failed: ${response.status} ${errorText}`);
    }

    // Handle JSON response
    const jsonData = await response.json();
    console.log('JSON response received:', JSON.stringify(jsonData, null, 2));

    if (!jsonData.success) {
      throw new Error(`Markdown extraction failed: ${JSON.stringify(jsonData.errors)}`);
    }

    // Return properly structured data with a markdown property
    return { markdown: jsonData.result };
  } catch (error) {
    console.error('Markdown extraction error:', error);
    throw error;
  }
}

/**
 * Extract structured JSON data from a webpage using Cloudflare Browser Rendering API
 */
export async function getJson({
  url,
  prompt,
  waitTime = 0,
}: {
  url: string;
  prompt?: string;
  waitTime?: number;
}): Promise<JsonExtractionResult> {
  // Check credits first (JSON extraction costs more because it uses AI)
  await checkCreditsAndAuth('json_extraction', {
    url,
    prompt,
    waitTime,
    timestamp: new Date().toISOString(),
  });

  try {
    // Generate a unique scrape ID
    const scrapeId = randomUUID();

    // Construct the payload
    const payload: Record<string, any> = {
      url,
      gotoOptions: {
        waitUntil: 'networkidle0',
        timeout: 45000,
      },
    };

    // Add prompt if provided
    if (prompt) {
      payload.prompt = prompt;
    }

    // Add waitTime if provided
    if (waitTime > 0) {
      payload.waitForTimeout = waitTime;
    }

    console.log('Sending JSON extraction request:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${BASE_URL}/accounts/${accountId}/browser-rendering/json`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('JSON extraction API error:', errorText);
      throw new Error(`JSON extraction failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.success && data.result) {
      // Add scrape_id if not present
      if (!data.result.scrape_id) {
        data.result.scrape_id = scrapeId;
      }
      // Return the structured data
      return data.result as JsonExtractionResult;
    }

    throw new Error('JSON extraction failed: No result in response');
  } catch (error) {
    console.error('JSON extraction error:', error);
    throw error;
  }
}

/**
 * Fetch the fully rendered HTML content from a webpage using Cloudflare Browser Rendering API
 */
export async function getContent({ url }: { url: string }) {
  // Check credits first
  await checkCreditsAndAuth('scrape_content', {
    url,
    timestamp: new Date().toISOString(),
  });

  try {
    const response = await fetch(`${BASE_URL}/accounts/${accountId}/browser-rendering/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTML content fetch failed: ${response.status} ${errorText}`);
    }

    // Check content type to determine response format
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('application/json')) {
      // Handle JSON response
      const jsonData = await response.json();

      if (!jsonData.success) {
        throw new Error(`HTML content fetch failed: ${JSON.stringify(jsonData.errors)}`);
      }

      // Return the HTML content from result property
      return { html: jsonData.result };
    } else {
      // Direct HTML response
      const htmlContent = await response.text();
      return { html: htmlContent };
    }
  } catch (error) {
    console.error('HTML content fetch error:', error);
    throw error;
  }
}

/**
 * Scrape HTML elements from a webpage using Cloudflare Browser Rendering API
 */
export async function getScrape({
  url,
  elements,
  waitTime = 0,
  headers,
  mobile,
  timeout,
}: {
  url: string;
  elements: Array<{ selector: string; attributes?: string[] }>;
  waitTime?: number;
  headers?: Record<string, string>;
  mobile?: boolean;
  timeout?: number;
}) {
  // Check credits first
  await checkCreditsAndAuth('scrape_elements', {
    url,
    elementsCount: elements?.length || 0,
    timestamp: new Date().toISOString(),
  });

  try {
    // Construct the payload with only supported parameters
    const payload: Record<string, any> = {
      url,
      elements,
      gotoOptions: {
        waitUntil: 'networkidle0',
        timeout: 45000,
      },
    };

    // Add optional parameters if provided
    if (waitTime > 0) {
      payload.waitForTimeout = waitTime;
    }

    if (headers && Object.keys(headers).length > 0) {
      payload.setExtraHTTPHeaders = headers;
    }

    if (mobile !== undefined) {
      payload.viewport = {
        width: 375,
        height: 667,
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      };
    }

    if (timeout !== undefined && timeout > 0) {
      payload.actionTimeout = timeout;
    }

    console.log('Sending scrape request:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${BASE_URL}/accounts/${accountId}/browser-rendering/scrape`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Scrape API error:', errorText);
      throw new Error(`Scrape failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.success && data.result) {
      // Return the structured data
      return { elements: data.result };
    }

    throw new Error('Scrape failed: No result in response');
  } catch (error) {
    console.error('Scrape error:', error);
    throw error;
  }
}

/**
 * Retrieve all links from a webpage using Cloudflare Browser Rendering API
 */
export async function getLinks({ url, includeExternal = true }: { url: string; includeExternal?: boolean }) {
  // Check credits first
  await checkCreditsAndAuth('scrape_links', {
    url,
    includeExternal,
    timestamp: new Date().toISOString(),
  });

  try {
    const payload = {
      url,
      includeExternal,
    };

    console.log('Sending links request:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${BASE_URL}/accounts/${accountId}/browser-rendering/links`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Links API error:', errorText);
      throw new Error(`Links retrieval failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();

    if (data.success && data.result) {
      // Return the links array
      return { links: data.result };
    }

    throw new Error('Links retrieval failed: No result in response');
  } catch (error) {
    console.error('Links retrieval error:', error);
    throw error;
  }
}
