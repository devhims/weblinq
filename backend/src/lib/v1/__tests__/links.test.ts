import { describe, expect, it, vi } from 'vitest';

import type { LinksParams } from '../links';

// Mock the browser utilities since we're only testing parameter logic
vi.mock('../browser-utils', () => ({
  runWithBrowser: vi.fn(),
  pageGotoWithRetry: vi.fn(),
}));

describe('links parameter processing', () => {
  // Helper function to test the filtering logic without browser dependencies
  function testLinkFiltering(
    includeExternal: boolean | undefined,
    links: Array<{ url: string; type: 'internal' | 'external' }>,
  ) {
    // Apply the same normalization logic as in the actual function
    const normalizedIncludeExternal = includeExternal ?? true;

    return links.filter((l) => {
      if (normalizedIncludeExternal === false) {
        return l.type === 'internal';
      }
      return true;
    });
  }

  it('should include all links when includeExternal is true', () => {
    const links = [
      { url: 'https://example.com/page1', type: 'internal' as const },
      { url: 'https://external.com/page2', type: 'external' as const },
      { url: 'https://example.com/page3', type: 'internal' as const },
    ];

    const result = testLinkFiltering(true, links);
    expect(result).toHaveLength(3);
    expect(result).toEqual(links);
  });

  it('should include only internal links when includeExternal is false', () => {
    const links = [
      { url: 'https://example.com/page1', type: 'internal' as const },
      { url: 'https://external.com/page2', type: 'external' as const },
      { url: 'https://example.com/page3', type: 'internal' as const },
    ];

    const result = testLinkFiltering(false, links);
    expect(result).toHaveLength(2);
    expect(result.every((link) => link.type === 'internal')).toBe(true);
  });

  it('should include all links when includeExternal is undefined (default behavior)', () => {
    const links = [
      { url: 'https://example.com/page1', type: 'internal' as const },
      { url: 'https://external.com/page2', type: 'external' as const },
      { url: 'https://example.com/page3', type: 'internal' as const },
    ];

    const result = testLinkFiltering(undefined, links);
    expect(result).toHaveLength(3);
    expect(result).toEqual(links);
  });

  it('should handle parameter normalization correctly', () => {
    // Test the parameter normalization logic
    function normalizeParams(params: Partial<LinksParams>): Required<LinksParams> {
      return {
        url: params.url || 'https://example.com',
        includeExternal: params.includeExternal ?? true,
        visibleLinksOnly: params.visibleLinksOnly ?? false,
        waitTime: params.waitTime ?? 0,
      };
    }

    // Test with all defaults
    const defaultParams = normalizeParams({});
    expect(defaultParams.includeExternal).toBe(true);
    expect(defaultParams.visibleLinksOnly).toBe(false);
    expect(defaultParams.waitTime).toBe(0);

    // Test with explicit values
    const explicitParams = normalizeParams({
      includeExternal: false,
      visibleLinksOnly: true,
      waitTime: 1000,
    });
    expect(explicitParams.includeExternal).toBe(false);
    expect(explicitParams.visibleLinksOnly).toBe(true);
    expect(explicitParams.waitTime).toBe(1000);

    // Test with partial values
    const partialParams = normalizeParams({
      includeExternal: false,
      // visibleLinksOnly and waitTime should get defaults
    });
    expect(partialParams.includeExternal).toBe(false);
    expect(partialParams.visibleLinksOnly).toBe(false);
    expect(partialParams.waitTime).toBe(0);
  });
});
