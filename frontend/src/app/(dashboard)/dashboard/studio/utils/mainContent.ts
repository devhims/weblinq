// Types for scraping results
interface ScrapeElement {
  selector: string;
  results: ElementResult[];
}

interface ElementResult {
  html: string;
  text: string;
  top?: number;
  left?: number;
}

interface ScrapeResult {
  elements: Array<{
    selector: string;
    results: Array<{
      html: string;
      text: string;
      top?: number;
      left?: number;
    }>;
  }>;
}

// For each selector, add alternative selectors that target main content areas
export function enhanceMainContentSelectors(
  elements: ScrapeElement[]
): ScrapeElement[] {
  // Keep the original selector unchanged to ensure basic functionality
  return elements.map((element) => element);
}

// Filter results to only include main content
export function filterMainContent(result: ScrapeResult): ScrapeResult {
  if (!result?.elements) {
    return { elements: [] };
  }

  console.log('Filtering results for main content only');

  // Process each element in the results
  const filteredElements = result.elements.map((item) => {
    // Keep the original selector
    const originalSelector = item.selector;

    // Filter the results to only include those likely to be in the main content
    const filteredResults = item.results.filter((element) => {
      // Skip empty elements
      if (!element.html || !element.text.trim()) {
        return false;
      }

      // Look for indicators that this element is in a non-content area
      const isInNavigation =
        element.html.includes('nav') ||
        element.html.includes('navbar') ||
        element.html.includes('menu-item');

      const isInFooter =
        element.html.includes('footer') ||
        element.html.toLowerCase().includes('copyright') ||
        element.html.includes('site-info');

      const isInHeader =
        element.html.includes('site-header') ||
        element.html.includes('top-header') ||
        element.html.includes('navbar-header');

      const isInSidebar =
        element.html.includes('sidebar') ||
        element.html.includes('widget') ||
        element.html.includes('aside');

      const isInAds =
        element.html.includes('ad-') ||
        element.html.includes('advertisement') ||
        element.html.includes('sponsored');

      // Check DOM position - main content is usually in the middle
      const isLikelyInMainContent =
        // Elements too close to top of page are likely in the header
        (element.top ?? 0) > 120 &&
        // Elements near the sides might be in sidebars
        (element.left ?? 0) > 50 &&
        // Preference for elements with substantial text content
        element.text.length > 10;

      // Return true only for elements likely to be in the main content
      return (
        !(
          isInNavigation ||
          isInFooter ||
          isInHeader ||
          isInSidebar ||
          isInAds
        ) && isLikelyInMainContent
      );
    });

    // Return the item with filtered results
    return {
      selector: originalSelector,
      results: filteredResults,
    };
  });

  // Filter out any selectors that no longer have results
  const nonEmptyElements = filteredElements.filter(
    (item) => item.results.length > 0
  );

  // If all selectors end up with no results, return some of the original results
  if (nonEmptyElements.length === 0 && result.elements.length > 0) {
    console.log(
      'No main content elements found, returning a subset of the original results'
    );

    // Get elements with the most text content as a fallback
    const elementsWithMostText = result.elements.map((item) => {
      const sortedResults = [...item.results].sort(
        (a, b) => b.text.length - a.text.length
      );
      return {
        selector: item.selector,
        results: sortedResults.slice(0, 2), // Return top 2 results with most text
      };
    });

    return {
      elements: elementsWithMostText.filter((item) => item.results.length > 0),
    };
  }

  return {
    elements: nonEmptyElements,
  };
}
