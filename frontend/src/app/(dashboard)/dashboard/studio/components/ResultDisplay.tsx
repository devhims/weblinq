'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Globe,
  FileText,
  FileDown,
  Link as LinkIcon,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  Type,
  CheckIcon,
  ClipboardIcon,
} from 'lucide-react';
import { ApiResult, ScreenshotResult, ScrapeResult, LinksResult } from '../types';
import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchResultDisplay } from './SearchResultDisplay';
import { CopyButton } from '@/components/ui/copy-button';
import { useStudioParams } from '../hooks/useStudioParams';
import { CodeDisplay } from './CodeDisplay';
import { ScreenshotDisplay } from './ScreenshotDisplay';
import pretty from 'pretty';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface ResultDisplayProps {
  loading: boolean;
  error: string | null;
  result: ApiResult;
  selectedEndpoint: string;
}

// New interface for combined results
interface CombinedResult {
  type: string;
  data: any;
}

interface CombinedResultsDisplayProps {
  results: CombinedResult[];
  fullPage?: boolean;
  isMobile?: boolean;
}

function CombinedResultsDisplay({ results, fullPage = false, isMobile = false }: CombinedResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState(results[0]?.type || 'elements');

  // Map result type to a display component
  const getResultComponent = (result: CombinedResult) => {
    switch (result.type) {
      case 'elements':
        return <ScrapeResultDisplay result={result.data} />;
      case 'markdown':
        return <CodeDisplay content={result.data} language="markdown" />;
      case 'screenshot':
        return <ScreenshotDisplay imageUrl={result.data.imageUrl} isMobile={isMobile} fullPage={fullPage} />;
      case 'links':
        return <LinksResultDisplay links={result.data} />;
      default:
        return (
          <div className="p-4 text-center">
            <p className="text-base">Unknown result type: {result.type}</p>
          </div>
        );
    }
  };

  return (
    <div className="border rounded-md overflow-hidden w-full">
      {/* Tabs for each result type */}
      <div className="flex border-b bg-card">
        {results.map((result) => (
          <button
            key={result.type}
            className={`px-4 py-3 font-medium text-base ${
              activeTab === result.type
                ? 'border-b-2 border-primary text-primary bg-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            }`}
            onClick={() => setActiveTab(result.type)}
          >
            {result.type.charAt(0).toUpperCase() + result.type.slice(1)}
          </button>
        ))}
      </div>

      {/* Content for active tab */}
      <div className="p-4">
        {results.find((r) => r.type === activeTab) ? (
          getResultComponent(results.find((r) => r.type === activeTab)!)
        ) : (
          <div className="p-4 text-center">
            <p className="text-base">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Add a LinksResultDisplay component for displaying links
interface LinksResultDisplayProps {
  links:
    | Array<{
        url: string;
        text: string;
        type: 'internal' | 'external';
      }>
    | string[];
}

function LinksResultDisplay({ links }: LinksResultDisplayProps) {
  // Handle both old format (array of strings) and new format (array of objects)
  const normalizedLinks = Array.isArray(links)
    ? links.map((link) => (typeof link === 'string' ? { url: link, text: link, type: 'external' as const } : link))
    : [];

  return (
    <div className="bg-card rounded-md border overflow-auto h-[800px] w-full relative">
      <CopyButton content={links} />
      <div className="p-4">
        <div className="flex items-center mb-3">
          <LinkIcon className="h-5 w-5 mr-2 text-primary" />
          <Label className="font-medium text-base">Found {normalizedLinks.length} links</Label>
        </div>
        <ul className="space-y-1.5">
          {normalizedLinks.length > 0 &&
            normalizedLinks.map((link, index) => (
              <li key={index} className="p-2.5 hover:bg-muted rounded-md break-all">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-start text-base"
                >
                  <Globe className="h-5 w-5 mr-2 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="font-medium">{link.text || link.url}</div>
                    <div className="text-xs text-muted-foreground">
                      {link.type} • {link.url}
                    </div>
                  </div>
                </a>
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}

export function ResultDisplay({ loading, error, result, selectedEndpoint }: ResultDisplayProps) {
  // derive fullPage flag from global params (mobile OR fullPage true)
  const { params } = useStudioParams();
  const isMobile = params.mobile ?? false;
  const fullPage = isMobile || params.fullPage !== false;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[800px]">
        <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 p-5 rounded-md border border-destructive/20 overflow-hidden break-words">
        <p className="text-destructive text-base font-medium">{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-[800px] text-center">
        <Globe className="h-12 w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-lg">Enter a URL and select an endpoint to see results</p>
      </div>
    );
  }

  // Handle combined results from multiple APIs
  if (result && typeof result === 'object' && 'combinedResults' in result) {
    return <CombinedResultsDisplay results={result.combinedResults} fullPage={fullPage} isMobile={isMobile} />;
  }

  switch (selectedEndpoint) {
    case 'html':
      const htmlContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return <CodeDisplay content={htmlContent} language="html" formatHtml={true} />;

    case 'scrape':
    case 'elements':
      const scrapeResult = result as ScrapeResult;
      // 🔄 Normalise legacy/alternate shapes where element data lives under `data` instead of `results`
      let normalised: ScrapeResult | null = null;

      if (scrapeResult && scrapeResult.elements && scrapeResult.elements.length > 0) {
        // Detect shape of first element
        const firstElement: any = scrapeResult.elements[0];
        if ('data' in firstElement && !('results' in firstElement)) {
          // Transform into expected structure
          normalised = {
            ...scrapeResult,
            elements: scrapeResult.elements.map((el: any) => {
              const candidate = el.data;
              // Ensure we have an array of results
              const resultsArr = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
              return {
                selector: el.selector,
                results: resultsArr,
              };
            }),
          } as ScrapeResult;
        }
      }

      const finalScrapeResult = normalised || scrapeResult;

      if (!finalScrapeResult || !finalScrapeResult.elements) {
        return (
          <div className="flex items-center justify-center h-[800px] text-center">
            <div className="text-muted-foreground">
              <p>No valid scrape results available</p>
            </div>
          </div>
        );
      }
      return <ScrapeResultDisplay result={finalScrapeResult} />;

    case 'screenshot':
      const screenshotResult = result as ScreenshotResult;
      return (
        <ScreenshotDisplay imageUrl={screenshotResult.imageUrl ?? undefined} isMobile={isMobile} fullPage={fullPage} />
      );

    case 'pdf':
      return (
        <div className="bg-card p-4 rounded-md border text-center overflow-auto w-full h-[800px] relative">
          <CopyButton content={'PDF generated successfully'} />
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p>PDF generated successfully</p>
          <Button variant="outline" size="sm" className="mt-2">
            <FileDown className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      );

    case 'json':
      return <CodeDisplay content={result} language="json" />;

    case 'markdown':
      const markdownContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return <CodeDisplay content={markdownContent} language="markdown" />;

    case 'links':
      return <LinksResultDisplay links={result as any} />;

    case 'web':
    case 'search':
      console.log('Search result data:', result);
      return <SearchResultDisplay result={result} />;

    default:
      return (
        <div className="bg-card p-4 rounded-md border overflow-auto h-[800px] w-full">
          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(result, null, 2)}</pre>
        </div>
      );
  }
}

interface ScrapeResultDisplayProps {
  result: ScrapeResult;
}

function ScrapeResultDisplay({ result }: ScrapeResultDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const [expandedAttributes, setExpandedAttributes] = useState<Record<string, boolean>>({});

  const toggleSection = (selector: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [selector]: !prev[selector],
    }));
  };

  const toggleAttributes = (resultId: string) => {
    setExpandedAttributes((prev) => ({
      ...prev,
      [resultId]: !prev[resultId],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Copy button with tooltip
  const [copiedItems, setCopiedItems] = useState<Record<string, boolean>>({});

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItems((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedItems((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Raw JSON view option
  const [showRaw, setShowRaw] = useState(false);

  const renderFormattedHtml = (html: string) => {
    // If the HTML is very short or empty, provide a clearer display
    if (!html.trim()) {
      return '<span class="text-muted-foreground italic">Empty element</span>';
    }

    // Check if it's an icon-only anchor tag or SVG icon
    const isIconElement =
      html.includes('aria-hidden="true"') ||
      html.includes('lucide') ||
      html.includes('<svg') ||
      html.includes('<span class') ||
      html.match(/<a[^>]*>(<[^>]+>)*<\/a>/) ||
      html.includes('size-') ||
      !html.includes('>');

    if (isIconElement) {
      return `<div class="p-2 bg-card rounded border border-border">
        <code class="text-primary">${escapeHtml(html)}</code>
      </div>`;
    }

    // Highlight special attributes in regular HTML
    const escaped = escapeHtml(html);

    return escaped
      .replace(/class="([^"]*)"/g, '<span class="text-primary">class</span>=<span class="text-green-300">"$1"</span>')
      .replace(
        /aria-([a-z]+)="([^"]*)"/g,
        '<span class="text-primary/80">aria-$1</span>=<span class="text-amber-200">"$2"</span>',
      )
      .replace(
        /href="([^"]*)"/g,
        '<span class="text-accent-foreground">href</span>=<span class="text-accent-foreground/80">"$1"</span>',
      )
      .replace(
        /target="([^"]*)"/g,
        '<span class="text-accent-foreground">target</span>=<span class="text-accent-foreground/80">"$1"</span>',
      )
      .replace(
        /rel="([^"]*)"/g,
        '<span class="text-accent-foreground">rel</span>=<span class="text-accent-foreground/80">"$1"</span>',
      );
  };

  // Helper function to escape HTML for display
  const escapeHtml = (html: string) => {
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  if (showRaw) {
    // Create a deep copy so we can prettify <html> strings without mutating original data
    const cloned: any = JSON.parse(JSON.stringify(result));

    if (cloned?.elements?.length) {
      cloned.elements.forEach((el: any) => {
        if (Array.isArray(el.results)) {
          el.results.forEach((r: any) => {
            if (typeof r.html === 'string') {
              try {
                r.html = pretty(r.html, { ocd: true });
              } catch {}
            }
          });
        }
      });
    }

    const jsonFormatted = JSON.stringify(cloned, null, 2);

    return (
      <div className="bg-card rounded-md border overflow-auto h-[800px] w-full">
        {/* header */}
        <div className="p-4 flex justify-between items-center">
          <h3 className="font-medium">Raw JSON</h3>
          <div className="flex space-x-2">
            {/* inline copy button so it sits left of the toggle */}
            <CopyButton content={jsonFormatted} inline />
            <Button variant="outline" size="sm" onClick={() => setShowRaw(false)}>
              View Structured
            </Button>
          </div>
        </div>

        {/* JSON */}
        <SyntaxHighlighter
          language="json"
          style={atomDark}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: 'var(--color-card)',
          }}
          wrapLongLines
          showLineNumbers
        >
          {jsonFormatted}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-md border overflow-auto h-[800px] w-full">
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-medium">Scraped Elements</h3>
          <div className="flex space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(JSON.stringify(result, null, 2), 'all')}
                    className="h-8 w-8 p-0"
                  >
                    {copiedItems['all'] ? (
                      <CheckIcon className="h-4 w-4 text-primary" />
                    ) : (
                      <ClipboardIcon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy all scraped data</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" onClick={() => setShowRaw(true)}>
              View Raw JSON
            </Button>
          </div>
        </div>

        {result &&
          result.elements &&
          result.elements.map((item, index) => (
            <div key={index} className="mb-6 border rounded-md overflow-hidden shadow-sm">
              <div
                className="bg-muted p-3 flex justify-between items-center cursor-pointer"
                onClick={() => toggleSection(item.selector)}
              >
                <div className="flex items-center">
                  <span className="mr-2">
                    {expandedSections[item.selector] ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>
                  {item.selector.includes(':not(') ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <code className="text-sm font-mono bg-accent px-2 py-1 rounded cursor-help">
                            {item.selector.split(':not(')[0]} (filtered)
                          </code>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-[300px] break-all">{item.selector}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <code className="text-sm font-mono bg-accent px-2 py-1 rounded">{item.selector}</code>
                  )}
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({item.results.length} {item.results.length === 1 ? 'result' : 'results'})
                  </span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(JSON.stringify(item.results, null, 2), `item-${index}`);
                        }}
                        className="h-8 w-8 p-0"
                      >
                        {copiedItems[`item-${index}`] ? (
                          <CheckIcon className="h-4 w-4 text-primary" />
                        ) : (
                          <ClipboardIcon className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Copy results for this selector</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {expandedSections[item.selector] && (
                <div className="divide-y divide-border">
                  {item.results.map((result, resultIndex) => {
                    const resultId = `${item.selector}-${resultIndex}`;

                    // Find the class attribute if it exists
                    const classAttribute = result.attributes.find((attr) => attr.name === 'class');

                    // Format HTML with highlighted class attributes for consistency
                    const formattedHtml = result.html.replace(
                      /class="([^"]*)"/g,
                      '<span class="text-primary">class</span>=<span class="text-primary/80">"$1"</span>',
                    );

                    return (
                      <div key={resultIndex} className="p-4 bg-background hover:bg-muted/40">
                        {/* Main text highlight section */}
                        {result.text && (
                          <div className="mb-3 bg-accent/30 p-3 rounded-md border border-border">
                            <div className="flex items-center mb-1">
                              <Type className="h-4 w-4 text-primary mr-2" />
                              <span className="text-sm font-medium text-primary">Text Content</span>
                            </div>
                            <p className="text-foreground font-medium break-words">
                              {result.text || <span className="text-muted-foreground italic">No text content</span>}
                            </p>
                          </div>
                        )}

                        {/* Attributes dropdown */}
                        {result.attributes.length > 0 && (
                          <div className="mb-3">
                            <button
                              onClick={() => toggleAttributes(resultId)}
                              className="flex items-center text-sm text-foreground bg-accent/20 px-3 py-2 rounded-md w-full"
                            >
                              <Info className="h-4 w-4 mr-2" />
                              <span className="font-medium">Attributes of this element</span>
                              <span className="ml-2 text-xs text-muted-foreground">({result.attributes.length})</span>
                              <span className="ml-auto">
                                {expandedAttributes[resultId] ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </span>
                            </button>

                            {expandedAttributes[resultId] && (
                              <div className="mt-2 bg-muted/50 p-3 rounded-md border border-border">
                                <div className="grid grid-cols-1 gap-2">
                                  {result.attributes.map((attr, attrIndex) => (
                                    <div key={attrIndex} className="bg-card p-2 rounded border text-xs">
                                      <span className="font-medium text-foreground">{attr.name}:</span>
                                      {attr.name === 'class' ? (
                                        <div className="mt-1 pl-4 border-l-2 border-primary/20">
                                          {attr.value.split(' ').map((cls, i) => (
                                            <span
                                              key={i}
                                              className="inline-block bg-accent/20 text-accent-foreground px-1 py-0.5 rounded mr-1 mb-1"
                                            >
                                              {cls}
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="ml-1 text-foreground break-all">"{attr.value}"</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* HTML Content dropdown */}
                        <details className="text-xs bg-muted rounded-md">
                          <summary className="cursor-pointer p-2 flex items-center text-sm font-medium text-foreground hover:text-primary">
                            <Layers className="h-4 w-4 mr-2" />
                            Complete HTML (including nested elements)
                          </summary>
                          <div className="bg-card rounded-b-md overflow-x-auto">
                            <div className="p-3">
                              <code
                                className="whitespace-pre-wrap block text-foreground"
                                dangerouslySetInnerHTML={{
                                  __html: renderFormattedHtml(result.html),
                                }}
                              />
                            </div>
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

        {result && result.elements && result.elements.length === 0 && (
          <div className="text-center p-6 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>No elements found matching your selectors.</p>
            <p className="text-sm mt-1">Try different selectors or URL parameters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
