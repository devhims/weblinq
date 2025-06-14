'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import {
  Globe,
  FileText,
  FileDown,
  Link as LinkIcon,
  Code,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  Type,
  CheckIcon,
  ClipboardIcon,
} from 'lucide-react';
import {
  ApiResult,
  ScreenshotResult,
  ScrapeResult,
  LinksResult,
} from '../types';
import { useState } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SearchResultDisplay } from './SearchResultDisplay';

// Copy button component to be used across different result displays
function CopyButton({
  content,
  darkBackground = false,
}: {
  content: any;
  darkBackground?: boolean;
}) {
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
            className={`absolute top-3 right-6 z-10 h-8 w-8 p-0 ${
              darkBackground
                ? 'text-muted hover:text-foreground hover:bg-accent/60'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
            }`}
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

interface ResultDisplayProps {
  loading: boolean;
  error: string | null;
  result: ApiResult;
  selectedEndpoint: string;
  fullPage?: boolean;
}

// New interface for combined results
interface CombinedResult {
  type: string;
  data: any;
}

interface CombinedResultsDisplayProps {
  results: CombinedResult[];
  fullPage?: boolean;
}

function CombinedResultsDisplay({
  results,
  fullPage = false,
}: CombinedResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState(results[0]?.type || 'elements');

  // Map result type to a display component
  const getResultComponent = (result: CombinedResult) => {
    switch (result.type) {
      case 'elements':
        return <ScrapeResultDisplay result={result.data} />;
      case 'markdown':
        return (
          <div className='bg-card rounded-md border overflow-auto h-[400px] w-full relative'>
            <CopyButton content={result.data} />
            <SyntaxHighlighter
              language='markdown'
              style={atomDark}
              customStyle={{
                margin: 0,
                borderRadius: '0.375rem',
                height: '100%',
                background: 'var(--color-card)',
              }}
              wrapLongLines={true}
              showLineNumbers={true}
            >
              {typeof result.data === 'string'
                ? result.data
                : JSON.stringify(result.data, null, 2)}
            </SyntaxHighlighter>
          </div>
        );
      case 'screenshot':
        return (
          <div
            className='border rounded-md overflow-auto w-full relative'
            style={{ maxHeight: 'calc(100vh - 250px)' }}
          >
            {result.data.imageUrl ? (
              <div className='relative'>
                <CopyButton
                  content={'Screenshot URL: ' + result.data.imageUrl}
                />
                <div className='sticky top-0 left-0 right-0 bg-muted/60 p-2 text-base text-center border-b z-10'>
                  This is a {fullPage ? 'full page' : 'viewport'} screenshot.{' '}
                  {fullPage && 'Scroll to see the entire page.'}
                </div>
                <div className='flex justify-center p-4'>
                  <Image
                    src={result.data.imageUrl}
                    alt='Screenshot preview'
                    width={1200}
                    height={800}
                    className='max-w-full rounded-md shadow object-contain'
                    style={{ width: 'auto', height: 'auto' }}
                    priority
                  />
                </div>
              </div>
            ) : (
              <div className='flex items-center justify-center h-64 w-full p-4'>
                <p className='text-muted-foreground text-base'>
                  No image available
                </p>
              </div>
            )}
          </div>
        );
      case 'links':
        return <LinksResultDisplay links={result.data} />;
      default:
        return (
          <div className='p-4 text-center'>
            <p className='text-base'>Unknown result type: {result.type}</p>
          </div>
        );
    }
  };

  return (
    <div className='border rounded-md overflow-hidden w-full'>
      {/* Tabs for each result type */}
      <div className='flex border-b bg-card'>
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
      <div className='p-4'>
        {results.find((r) => r.type === activeTab) ? (
          getResultComponent(results.find((r) => r.type === activeTab)!)
        ) : (
          <div className='p-4 text-center'>
            <p className='text-base'>No data available</p>
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
    ? links.map((link) =>
        typeof link === 'string'
          ? { url: link, text: link, type: 'external' as const }
          : link
      )
    : [];

  return (
    <div className='bg-card rounded-md border overflow-auto h-[400px] w-full relative'>
      <CopyButton content={links} />
      <div className='p-4'>
        <div className='flex items-center mb-3'>
          <LinkIcon className='h-5 w-5 mr-2 text-primary' />
          <Label className='font-medium text-base'>
            Found {normalizedLinks.length} links
          </Label>
        </div>
        <ul className='space-y-1.5'>
          {normalizedLinks.length > 0 &&
            normalizedLinks.map((link, index) => (
              <li
                key={index}
                className='p-2.5 hover:bg-muted rounded-md break-all'
              >
                <a
                  href={link.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline flex items-start text-base'
                >
                  <Globe className='h-5 w-5 mr-2 mt-1 flex-shrink-0' />
                  <div className='flex-1'>
                    <div className='font-medium'>{link.text || link.url}</div>
                    <div className='text-xs text-muted-foreground'>
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

export function ResultDisplay({
  loading,
  error,
  result,
  selectedEndpoint,
  fullPage = false,
}: ResultDisplayProps) {
  if (loading) {
    return (
      <div className='flex items-center justify-center h-[400px]'>
        <div className='animate-spin rounded-full h-14 w-14 border-b-2 border-primary'></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='bg-destructive/10 p-5 rounded-md border border-destructive/20 overflow-hidden break-words'>
        <p className='text-destructive text-base font-medium'>{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className='flex flex-col items-center justify-center h-[400px] text-center'>
        <Globe className='h-12 w-12 text-muted-foreground mb-3' />
        <p className='text-muted-foreground text-lg'>
          Enter a URL and select an endpoint to see results
        </p>
      </div>
    );
  }

  // Handle combined results from multiple APIs
  if (result && typeof result === 'object' && 'combinedResults' in result) {
    return (
      <CombinedResultsDisplay
        results={result.combinedResults}
        fullPage={fullPage}
      />
    );
  }

  switch (selectedEndpoint) {
    case 'html':
      return (
        <div className='bg-card rounded-md border overflow-auto h-[400px] w-full relative'>
          <CopyButton
            content={
              typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2)
            }
          />
          <SyntaxHighlighter
            language='html'
            style={atomDark}
            customStyle={{
              margin: 0,
              borderRadius: '0.375rem',
              height: '100%',
              fontSize: '14px',
              background: 'var(--color-card)',
            }}
            wrapLongLines={true}
            showLineNumbers={true}
          >
            {typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2)}
          </SyntaxHighlighter>
        </div>
      );

    case 'scrape':
    case 'elements':
      const scrapeResult = result as ScrapeResult;
      if (!scrapeResult || !scrapeResult.elements) {
        return (
          <div className='flex items-center justify-center h-[400px] text-center'>
            <div className='text-muted-foreground'>
              <p>No valid scrape results available</p>
            </div>
          </div>
        );
      }
      return <ScrapeResultDisplay result={scrapeResult} />;

    case 'screenshot':
      const screenshotResult = result as ScreenshotResult;
      return (
        <div
          className='border rounded-md overflow-auto w-full relative'
          style={{ maxHeight: 'calc(100vh - 250px)' }}
        >
          {screenshotResult.imageUrl ? (
            <div className='relative'>
              <CopyButton
                content={'Screenshot URL: ' + screenshotResult.imageUrl}
              />
              <div className='sticky top-0 left-0 right-0 bg-muted p-2 text-xs text-center border-b z-10'>
                This is a {fullPage ? 'full page' : 'viewport'} screenshot.{' '}
                {fullPage && 'Scroll to see the entire page.'}
              </div>
              <div className='flex justify-center p-4'>
                <Image
                  src={screenshotResult.imageUrl}
                  alt='Screenshot preview'
                  width={1200}
                  height={800}
                  className='max-w-full rounded-md shadow object-contain'
                  style={{ width: 'auto', height: 'auto' }}
                  priority
                />
              </div>
            </div>
          ) : (
            <div className='flex items-center justify-center h-64 w-full p-4'>
              <p className='text-muted-foreground'>No image available</p>
            </div>
          )}
        </div>
      );

    case 'pdf':
      return (
        <div className='bg-card p-4 rounded-md border text-center overflow-auto w-full h-[400px] relative'>
          <CopyButton content={'PDF generated successfully'} />
          <FileText className='h-10 w-10 text-muted-foreground mx-auto mb-2' />
          <p>PDF generated successfully</p>
          <Button variant='outline' size='sm' className='mt-2'>
            <FileDown className='h-4 w-4 mr-2' />
            Download PDF
          </Button>
        </div>
      );

    case 'json':
      return (
        <div className='bg-card rounded-md border overflow-auto h-[400px] w-full relative'>
          <CopyButton content={result} darkBackground={true} />
          <SyntaxHighlighter
            language='json'
            style={atomDark}
            customStyle={{
              margin: 0,
              borderRadius: '0.375rem',
              height: '100%',
              background: 'var(--color-card)',
            }}
            wrapLongLines={true}
            showLineNumbers={true}
          >
            {JSON.stringify(result, null, 2)}
          </SyntaxHighlighter>
        </div>
      );

    case 'markdown':
      return (
        <div className='bg-card rounded-md border overflow-auto h-[400px] w-full relative'>
          <CopyButton content={result} />
          <SyntaxHighlighter
            language='markdown'
            style={atomDark}
            customStyle={{
              margin: 0,
              borderRadius: '0.375rem',
              height: '100%',
              background: 'var(--color-card)',
            }}
            wrapLongLines={true}
            showLineNumbers={true}
          >
            {typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2)}
          </SyntaxHighlighter>
        </div>
      );

    case 'links':
      return <LinksResultDisplay links={result as any} />;

    case 'web':
    case 'search':
      console.log('Search result data:', result);
      return <SearchResultDisplay result={result} />;

    default:
      return (
        <div className='bg-card p-4 rounded-md border overflow-auto h-[400px] w-full'>
          <pre className='whitespace-pre-wrap break-words'>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      );
  }
}

interface ScrapeResultDisplayProps {
  result: ScrapeResult;
}

function ScrapeResultDisplay({ result }: ScrapeResultDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const [expandedAttributes, setExpandedAttributes] = useState<
    Record<string, boolean>
  >({});

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
    return html
      .replace(
        /class="([^"]*)"/g,
        '<span class="text-primary">class</span>=<span class="text-green-300">"$1"</span>'
      )
      .replace(
        /aria-([a-z]+)="([^"]*)"/g,
        '<span class="text-primary/80">aria-$1</span>=<span class="text-amber-200">"$2"</span>'
      )
      .replace(
        /href="([^"]*)"/g,
        '<span class="text-accent-foreground">href</span>=<span class="text-accent-foreground/80">"$1"</span>'
      )
      .replace(
        /target="([^"]*)"/g,
        '<span class="text-accent-foreground">target</span>=<span class="text-accent-foreground/80">"$1"</span>'
      )
      .replace(
        /rel="([^"]*)"/g,
        '<span class="text-accent-foreground">rel</span>=<span class="text-accent-foreground/80">"$1"</span>'
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
    return (
      <div className='bg-card rounded-md border overflow-auto h-[400px] w-full relative'>
        <Button
          variant='outline'
          size='sm'
          className='absolute top-2 right-2 z-10'
          onClick={() => setShowRaw(false)}
        >
          Show Structured View
        </Button>
        <CopyButton content={result} darkBackground={true} />
        <SyntaxHighlighter
          language='json'
          style={atomDark}
          customStyle={{
            margin: 0,
            borderRadius: '0.375rem',
            height: '100%',
            background: 'var(--color-card)',
          }}
          wrapLongLines={true}
          showLineNumbers={true}
        >
          {JSON.stringify(result, null, 2)}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <div className='bg-card rounded-md border overflow-auto h-[400px] w-full'>
      <div className='p-4'>
        <div className='flex justify-between items-center mb-4'>
          <h3 className='font-medium'>Scraped Elements</h3>
          <div className='flex space-x-2'>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() =>
                      handleCopy(JSON.stringify(result, null, 2), 'all')
                    }
                    className='h-8 w-8 p-0'
                  >
                    {copiedItems['all'] ? (
                      <CheckIcon className='h-4 w-4 text-primary' />
                    ) : (
                      <ClipboardIcon className='h-4 w-4' />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy all scraped data</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowRaw(true)}
            >
              View Raw JSON
            </Button>
          </div>
        </div>

        {result &&
          result.elements &&
          result.elements.map((item, index) => (
            <div
              key={index}
              className='mb-6 border rounded-md overflow-hidden shadow-sm'
            >
              <div
                className='bg-muted p-3 flex justify-between items-center cursor-pointer'
                onClick={() => toggleSection(item.selector)}
              >
                <div className='flex items-center'>
                  <span className='mr-2'>
                    {expandedSections[item.selector] ? (
                      <ChevronDown className='h-4 w-4' />
                    ) : (
                      <ChevronRight className='h-4 w-4' />
                    )}
                  </span>
                  {item.selector.includes(':not(') ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <code className='text-sm font-mono bg-accent px-2 py-1 rounded cursor-help'>
                            {item.selector.split(':not(')[0]} (filtered)
                          </code>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className='text-xs max-w-[300px] break-all'>
                            {item.selector}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <code className='text-sm font-mono bg-accent px-2 py-1 rounded'>
                      {item.selector}
                    </code>
                  )}
                  <span className='ml-2 text-sm text-muted-foreground'>
                    ({item.results.length}{' '}
                    {item.results.length === 1 ? 'result' : 'results'})
                  </span>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(
                            JSON.stringify(item.results, null, 2),
                            `item-${index}`
                          );
                        }}
                        className='h-8 w-8 p-0'
                      >
                        {copiedItems[`item-${index}`] ? (
                          <CheckIcon className='h-4 w-4 text-primary' />
                        ) : (
                          <ClipboardIcon className='h-4 w-4' />
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
                <div className='divide-y divide-border'>
                  {item.results.map((result, resultIndex) => {
                    const resultId = `${item.selector}-${resultIndex}`;

                    // Find the class attribute if it exists
                    const classAttribute = result.attributes.find(
                      (attr) => attr.name === 'class'
                    );

                    // Format HTML with highlighted class attributes for consistency
                    const formattedHtml = result.html.replace(
                      /class="([^"]*)"/g,
                      '<span class="text-primary">class</span>=<span class="text-primary/80">"$1"</span>'
                    );

                    return (
                      <div
                        key={resultIndex}
                        className='p-4 bg-background hover:bg-muted/40'
                      >
                        {/* Main text highlight section */}
                        <div className='mb-3 bg-accent/30 p-3 rounded-md border border-border'>
                          <div className='flex items-center mb-1'>
                            <Type className='h-4 w-4 text-primary mr-2' />
                            <span className='text-sm font-medium text-primary'>
                              Text Content
                            </span>
                          </div>
                          <p className='text-foreground font-medium break-words'>
                            {result.text || (
                              <span className='text-muted-foreground italic'>
                                No text content
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Size and position */}
                        <div className='flex flex-wrap gap-2 mb-3'>
                          <div className='flex items-center text-xs bg-accent/20 text-accent-foreground px-2 py-1 rounded'>
                            <span className='font-medium mr-1'>Size:</span>{' '}
                            {result.width}×{result.height}
                          </div>
                          <div className='flex items-center text-xs bg-accent/30 text-accent-foreground px-2 py-1 rounded'>
                            <span className='font-medium mr-1'>Position:</span>{' '}
                            {Math.round(result.left)},{Math.round(result.top)}
                          </div>
                        </div>

                        {/* Attributes dropdown */}
                        {result.attributes.length > 0 && (
                          <div className='mb-3'>
                            <button
                              onClick={() => toggleAttributes(resultId)}
                              className='flex items-center text-sm text-foreground bg-accent/20 px-3 py-2 rounded-md w-full'
                            >
                              <Info className='h-4 w-4 mr-2' />
                              <span className='font-medium'>
                                Attributes of this element
                              </span>
                              <span className='ml-2 text-xs text-muted-foreground'>
                                ({result.attributes.length})
                              </span>
                              <span className='ml-auto'>
                                {expandedAttributes[resultId] ? (
                                  <ChevronDown className='h-4 w-4' />
                                ) : (
                                  <ChevronRight className='h-4 w-4' />
                                )}
                              </span>
                            </button>

                            {expandedAttributes[resultId] && (
                              <div className='mt-2 bg-muted/50 p-3 rounded-md border border-border'>
                                <div className='grid grid-cols-1 gap-2'>
                                  {result.attributes.map((attr, attrIndex) => (
                                    <div
                                      key={attrIndex}
                                      className='bg-card p-2 rounded border text-xs'
                                    >
                                      <span className='font-medium text-foreground'>
                                        {attr.name}:
                                      </span>
                                      {attr.name === 'class' ? (
                                        <div className='mt-1 pl-4 border-l-2 border-primary/20'>
                                          {attr.value
                                            .split(' ')
                                            .map((cls, i) => (
                                              <span
                                                key={i}
                                                className='inline-block bg-accent/20 text-accent-foreground px-1 py-0.5 rounded mr-1 mb-1'
                                              >
                                                {cls}
                                              </span>
                                            ))}
                                        </div>
                                      ) : (
                                        <span className='ml-1 text-foreground break-all'>
                                          "{attr.value}"
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* HTML Content dropdown */}
                        <details className='text-xs bg-muted rounded-md'>
                          <summary className='cursor-pointer p-2 flex items-center text-sm font-medium text-foreground hover:text-primary'>
                            <Layers className='h-4 w-4 mr-2' />
                            Complete HTML (including nested elements)
                          </summary>
                          <div className='bg-card rounded-b-md overflow-x-auto'>
                            <div className='p-2 bg-muted text-xs text-foreground'>
                              <p>
                                This shows the complete HTML including any
                                nested elements inside the matched element.
                              </p>
                              <p className='mt-1'>
                                Note: Nested elements may have their own classes
                                and attributes that are different from the
                                parent element.
                              </p>
                            </div>
                            <div className='p-3'>
                              <code
                                className='whitespace-pre-wrap block text-foreground'
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
          <div className='text-center p-6 text-muted-foreground'>
            <Layers className='h-12 w-12 mx-auto mb-2 opacity-30' />
            <p>No elements found matching your selectors.</p>
            <p className='text-sm mt-1'>
              Try different selectors or URL parameters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
