'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Globe,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  Type,
  CheckIcon,
  ClipboardIcon,
  MessageSquareText,
  AlertCircle,
  Youtube,
  ExternalLink,
  BarChart3,
  Search,
  X,
  Play,
  Clock,
  CheckCircle,
  Copy,
  LinkIcon,
} from 'lucide-react';
import {
  ApiResult,
  ScreenshotResult,
  ScrapeResult,
  LinksResult,
  SearchResponse,
  YouTubeCaptionsResult,
} from '../types';
import { useState, useEffect } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SearchResultDisplay } from './SearchResultDisplay';
import { CopyButton } from '@/components/ui/copy-button';
import { useStudioParams } from '../hooks/useStudioParams';
import { CodeDisplay } from './CodeDisplay';
import { ScreenshotDisplay } from './ScreenshotDisplay';
import { studioApi } from '@/lib/studio-api';
import {
  downloadBlob,
  generateScreenshotFilename,
  generatePdfFilename,
  formatFileSize,
} from '@/lib/utils';
import { toast } from 'sonner';
import pretty from 'pretty';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { getErrorMessage } from '@/lib/error-utils';

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

function CombinedResultsDisplay({
  results,
  fullPage = false,
  isMobile = false,
}: CombinedResultsDisplayProps) {
  const [activeTab, setActiveTab] = useState(results[0]?.type || 'elements');

  // Map result type to a display component
  const getResultComponent = (result: CombinedResult) => {
    switch (result.type) {
      case 'elements':
        return <ScrapeResultDisplay result={result.data} />;
      case 'markdown':
        return <CodeDisplay content={result.data} language="markdown" />;
      case 'screenshot':
        return (
          <ScreenshotDisplay
            imageUrl={result.data.imageUrl}
            isMobile={isMobile}
            fullPage={fullPage}
          />
        );
      case 'links':
        return <LinksResultDisplay links={result.data} />;
      default:
        return (
          <div className="p-3 sm:p-4 text-center">
            <p className="text-sm sm:text-base">
              Unknown result type: {result.type}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="border rounded-md overflow-hidden w-full">
      {/* Tabs for each result type */}
      <div className="flex border-b bg-card overflow-x-auto">
        {results.map((result) => (
          <button
            key={result.type}
            className={`px-3 sm:px-4 py-2 sm:py-3 font-medium text-sm sm:text-base whitespace-nowrap ${
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
      <div className="p-3 sm:p-4">
        {results.find((r) => r.type === activeTab) ? (
          getResultComponent(results.find((r) => r.type === activeTab)!)
        ) : (
          <div className="p-3 sm:p-4 text-center">
            <p className="text-sm sm:text-base">No data available</p>
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
          : link,
      )
    : [];

  return (
    <div className="bg-card rounded-md border h-full w-full relative flex flex-col">
      <div className="bg-card/90 backdrop-blur-sm border-b border-border/50 p-3 sm:p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-primary" />
            <Label className="font-medium text-sm sm:text-base">
              Found {normalizedLinks.length} links
            </Label>
          </div>
          <CopyButton content={links} inline />
        </div>
      </div>
      <div className="p-3 sm:p-4 pt-0 flex-1 overflow-y-auto">
        <ul className="space-y-1.5">
          {normalizedLinks.length > 0 &&
            normalizedLinks.map((link, index) => (
              <li
                key={index}
                className="p-2 sm:p-2.5 hover:bg-muted rounded-md break-all"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-start text-sm sm:text-base"
                >
                  <Globe className="h-4 w-4 sm:h-5 sm:w-5 mr-2 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate sm:whitespace-normal">
                      {link.text || link.url}
                    </div>
                    <div className="text-xs text-muted-foreground truncate sm:whitespace-normal">
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
}: ResultDisplayProps) {
  // derive fullPage flag from global params (mobile OR fullPage true)
  const { params } = useStudioParams();
  const isMobile = params.mobile ?? false;
  const fullPage = isMobile || params.fullPage !== false;

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | undefined>();
  // Download handlers using existing data (no additional HTTP requests)
  const handleScreenshotDownload = (imageData: Uint8Array, metadata?: any) => {
    if (!params.url) return;

    try {
      // Ensure we have a proper Uint8Array for the Blob constructor
      const uint8Data = new Uint8Array(imageData);
      const format = metadata?.format || 'png';
      const blob = new Blob([uint8Data], { type: `image/${format}` });
      const filename = generateScreenshotFilename(params.url, format);
      downloadBlob(blob, filename);

      toast.success(
        `Screenshot downloaded as ${filename} (${formatFileSize(blob.size)})`,
      );
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download screenshot');
    }
  };

  const handlePdfDownload = (pdfData: Uint8Array, metadata?: any) => {
    if (!params.url) return;

    try {
      // Ensure we have a proper Uint8Array for the Blob constructor
      const uint8Data = new Uint8Array(pdfData);
      const blob = new Blob([uint8Data], { type: 'application/pdf' });
      const filename = generatePdfFilename(params.url);
      downloadBlob(blob, filename);

      toast.success(
        `PDF downloaded as ${filename} (${formatFileSize(blob.size)})`,
      );
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download PDF');
    }
  };

  // Update PDF preview URL whenever a new PDF binary data arrives
  useEffect(() => {
    if (selectedEndpoint !== 'pdf') {
      if (pdfPreviewUrl) setPdfPreviewUrl(undefined);
      return;
    }

    const pdfResult = result as any;
    const pdfData =
      pdfResult && typeof pdfResult === 'object'
        ? (pdfResult.pdf ?? pdfResult.data?.pdf)
        : undefined;
    const pdfPermanentUrl = pdfResult?.data?.permanentUrl;

    // Prioritize permanent URL for preview if available
    if (pdfPermanentUrl) {
      console.log('✅ Using permanent URL for PDF preview:', pdfPermanentUrl);
      setPdfPreviewUrl(pdfPermanentUrl);
      return;
    }

    // Fallback to creating blob URL from binary data
    if (!pdfData || !(pdfData instanceof Uint8Array)) {
      setPdfPreviewUrl(undefined);
      return;
    }

    try {
      console.log(
        '⚠️ Using fallback blob URL for PDF preview (no permanent URL available)',
      );
      // Ensure we have a proper Uint8Array for the Blob constructor
      const uint8Data = new Uint8Array(pdfData);
      const blob = new Blob([uint8Data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to create PDF blob URL:', error);
      setPdfPreviewUrl(undefined);
    }
  }, [selectedEndpoint, result]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[200px] sm:h-[300px] lg:h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] sm:h-[300px] lg:h-[400px] text-center px-4">
        <AlertCircle className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-destructive mb-3" />
        <div className="space-y-2">
          <p className="text-destructive font-medium text-sm sm:text-base">
            Error occurred
          </p>
          <p className="text-muted-foreground text-xs sm:text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] sm:h-[300px] lg:h-[400px] text-center px-4">
        <Globe className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground text-sm sm:text-md">
          Enter a URL and select an endpoint to see results
        </p>
      </div>
    );
  }

  // Handle combined results from multiple APIs
  if (result && typeof result === 'object' && 'combinedResults' in result) {
    return (
      <CombinedResultsDisplay
        results={(result as any).combinedResults as CombinedResult[]}
        fullPage={fullPage}
        isMobile={isMobile}
      />
    );
  }

  switch (selectedEndpoint) {
    case 'html':
      const htmlContent =
        typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return (
        <CodeDisplay content={htmlContent} language="html" formatHtml={true} />
      );

    case 'scrape':
    case 'elements':
      const scrapeResult = result as ScrapeResult;
      // 🔄 Normalise legacy/alternate shapes where element data lives under `data` instead of `results`
      let normalised: ScrapeResult | null = null;

      if (
        scrapeResult &&
        scrapeResult.elements &&
        scrapeResult.elements.length > 0
      ) {
        // Detect shape of first element
        const firstElement: any = scrapeResult.elements[0];
        if ('data' in firstElement && !('results' in firstElement)) {
          // Transform into expected structure
          normalised = {
            ...scrapeResult,
            elements: scrapeResult.elements.map((el: any) => {
              const candidate = el.data;
              // Ensure we have an array of results
              const resultsArr = Array.isArray(candidate)
                ? candidate
                : candidate
                  ? [candidate]
                  : [];
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
          <div className="flex items-center justify-center h-[200px] sm:h-[300px] lg:h-[400px] text-center px-4">
            <div className="text-muted-foreground">
              <p className="text-sm sm:text-base">
                No valid scrape results available
              </p>
            </div>
          </div>
        );
      }
      return <ScrapeResultDisplay result={finalScrapeResult} />;

    case 'screenshot':
      const screenshotResult = result as {
        image?: string | Uint8Array;
        data?: {
          image?: string | Uint8Array;
          metadata?: any;
          permanentUrl?: string;
          fileId?: string;
        };
      };
      const imageData =
        screenshotResult?.image ?? screenshotResult?.data?.image;
      const imageMetadata = screenshotResult?.data?.metadata;
      const permanentUrl = screenshotResult?.data?.permanentUrl;
      const fileId = screenshotResult?.data?.fileId;

      console.log('🖼️ Screenshot result data:', {
        hasImageData: !!imageData,
        imageDataType: typeof imageData,
        hasPermanentUrl: !!permanentUrl,
        permanentUrl,
        fileId,
        metadata: imageMetadata,
      });

      // Create display URL - prioritize permanent URL, fallback to blob URL
      let imageUrl: string | undefined;

      if (permanentUrl) {
        // Use permanent URL for both preview and copying
        imageUrl = permanentUrl;
        console.log('✅ Using permanent URL for display:', permanentUrl);
      } else if (imageData) {
        // Fallback to creating blob URL for preview
        try {
          let blob: Blob;
          if (typeof imageData === 'string') {
            // Base64 string
            const binaryString = atob(imageData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const format = imageMetadata?.format || 'png';
            blob = new Blob([bytes], { type: `image/${format}` });
          } else if (imageData instanceof Uint8Array) {
            // Binary data
            const format = imageMetadata?.format || 'png';
            blob = new Blob([new Uint8Array(imageData)], {
              type: `image/${format}`,
            });
          } else {
            throw new Error('Unsupported image data format');
          }

          imageUrl = URL.createObjectURL(blob);
          console.log(
            '⚠️ Using fallback blob URL for display (no permanent URL available)',
          );
        } catch (error) {
          console.error('Failed to create image blob URL:', error);
        }
      }

      // Determine what to copy - permanent URL if available, otherwise blob URL
      const copyUrl = permanentUrl || imageUrl;

      return (
        <div className="bg-card p-3 sm:p-4 rounded-md border overflow-hidden w-full relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <p className="text-sm sm:text-base font-medium">Preview</p>
            </div>
            {imageData && (
              <div className="flex items-center gap-2">
                {copyUrl && <CopyButton content={copyUrl} inline />}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (typeof imageData === 'string') {
                      // Convert base64 to Uint8Array for download
                      const binaryString = atob(imageData);
                      const bytes = new Uint8Array(binaryString.length);
                      for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                      }
                      handleScreenshotDownload(bytes, imageMetadata);
                    } else if (imageData instanceof Uint8Array) {
                      handleScreenshotDownload(imageData, imageMetadata);
                    }
                  }}
                  className="text-xs sm:text-sm"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Download
                </Button>
              </div>
            )}
          </div>
          <ScreenshotDisplay
            imageUrl={imageUrl}
            isMobile={isMobile}
            fullPage={fullPage}
          />
        </div>
      );

    case 'pdf':
      const pdfResult = result as {
        pdf?: Uint8Array;
        data?: {
          pdf?: Uint8Array;
          metadata?: any;
          permanentUrl?: string;
          fileId?: string;
        };
      };
      const pdfData = (pdfResult?.pdf ?? pdfResult?.data?.pdf) as
        | Uint8Array
        | undefined;
      const pdfMetadata = pdfResult?.data?.metadata;
      const pdfPermanentUrl = pdfResult?.data?.permanentUrl;
      const pdfFileId = pdfResult?.data?.fileId;

      console.log('📄 PDF result data:', {
        hasPdfData: !!pdfData,
        pdfDataType: typeof pdfData,
        hasPermanentUrl: !!pdfPermanentUrl,
        permanentUrl: pdfPermanentUrl,
        fileId: pdfFileId,
        metadata: pdfMetadata,
      });

      // Determine what to copy - permanent URL if available, otherwise blob URL
      const copyPdfUrl = pdfPermanentUrl || pdfPreviewUrl;

      return (
        <div className="bg-card p-3 sm:p-4 rounded-md border overflow-hidden w-full relative">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
              <p className="text-sm sm:text-base font-medium">
                {pdfData ? 'Preview' : 'No PDF data returned'}
              </p>
            </div>
            {pdfData && (
              <div className="flex items-center gap-2">
                {copyPdfUrl && <CopyButton content={copyPdfUrl} inline />}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePdfDownload(pdfData, pdfMetadata)}
                  className="text-xs sm:text-sm"
                >
                  <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                  Download
                </Button>
              </div>
            )}
          </div>

          {/* Preview */}
          {pdfPreviewUrl ? (
            <iframe
              title="PDF preview"
              src={pdfPreviewUrl}
              className="w-full h-[600px] sm:h-[700px] lg:h-[800px] border rounded"
            />
          ) : (
            <div className="text-center text-muted-foreground h-[400px] flex items-center justify-center">
              <p className="text-sm sm:text-base">No PDF data</p>
            </div>
          )}
        </div>
      );

    case 'json':
    case 'text':
      // Handle both new response format and legacy format
      const jsonResult = result as any;
      if (jsonResult && typeof jsonResult === 'object') {
        // New format with responseType metadata
        if (
          jsonResult.data?.metadata?.responseType === 'text' &&
          jsonResult.data?.text
        ) {
          // Text response - display as markdown for better formatting
          return (
            <div className="bg-card p-3 sm:p-4 rounded-md border overflow-hidden w-full relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <p className="text-sm sm:text-base font-medium">
                    AI Analysis
                  </p>
                </div>
                <CopyButton content={jsonResult.data.text} inline />
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {jsonResult.data.text}
                </div>
              </div>
              {jsonResult.data.metadata && (
                <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span>Model: {jsonResult.data.metadata.model}</span>
                    {jsonResult.data.metadata.inputTokens && (
                      <span>
                        Input: {jsonResult.data.metadata.inputTokens} tokens
                      </span>
                    )}
                    {jsonResult.data.metadata.outputTokens && (
                      <span>
                        Output: {jsonResult.data.metadata.outputTokens} tokens
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        } else if (jsonResult.data?.extracted) {
          // JSON response - display as formatted JSON
          return (
            <CodeDisplay content={jsonResult.data.extracted} language="json" />
          );
        } else if (jsonResult.success === false) {
          // Error response - handle StandardErrorSchema format
          const errorMessage =
            jsonResult.error?.message || 'Unknown error occurred';

          return (
            <div className="bg-destructive/10 p-4 sm:p-5 rounded-md border border-destructive/20 overflow-hidden break-words">
              <p className="text-destructive text-sm sm:text-base font-medium">
                {errorMessage}
              </p>
            </div>
          );
        }
      }
      // Fallback for any other format
      return <CodeDisplay content={result} language="json" />;

    case 'markdown':
      const markdownContent =
        typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      return <CodeDisplay content={markdownContent} language="markdown" />;

    case 'links':
      return <LinksResultDisplay links={result as any} />;

    case 'web':
    case 'search':
      console.log('Search result data:', result);
      // Type guard to ensure we have a proper SearchResponse
      if (
        result &&
        typeof result === 'object' &&
        !Array.isArray(result) &&
        'results' in result
      ) {
        return <SearchResultDisplay result={result as SearchResponse} />;
      }
      // Fallback for unexpected result format
      return (
        <div className="bg-card p-3 sm:p-4 rounded-md border h-full w-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <pre className="whitespace-pre-wrap break-words text-xs sm:text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      );

    case 'youtube':
    case 'captions':
      console.log('YouTube captions result data:', result);
      // Type guard to ensure we have a proper YouTubeCaptionsResult
      if (
        result &&
        typeof result === 'object' &&
        !Array.isArray(result) &&
        'captions' in result &&
        'videoId' in result
      ) {
        return (
          <YouTubeCaptionsDisplay result={result as YouTubeCaptionsResult} />
        );
      }
      // Fallback for unexpected result format
      return (
        <div className="bg-card p-3 sm:p-4 rounded-md border h-full w-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <pre className="whitespace-pre-wrap break-words text-xs sm:text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      );

    default:
      return (
        <div className="bg-card p-3 sm:p-4 rounded-md border h-full w-full flex flex-col">
          <div className="flex-1 overflow-y-auto">
            <pre className="whitespace-pre-wrap break-words text-xs sm:text-sm">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
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
    const escaped = escapeHtml(html);

    return escaped
      .replace(
        /class="([^"]*)"/g,
        '<span class="text-primary">class</span>=<span class="text-green-300">"$1"</span>',
      )
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
      <div className="bg-card rounded-md border h-full w-full flex flex-col">
        {/* header */}
        <div className="bg-card/90 backdrop-blur-sm border-b border-border/50 p-3 sm:p-4 flex-shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="font-medium text-sm sm:text-base">Raw JSON</h3>
          <div className="flex space-x-2">
            {/* inline copy button so it sits left of the toggle */}
            <CopyButton content={jsonFormatted} inline />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRaw(false)}
              className="text-xs sm:text-sm"
            >
              View AI Extract
            </Button>
          </div>
        </div>

        {/* JSON */}
        <div className="flex-1 overflow-hidden">
          <SyntaxHighlighter
            language="json"
            style={atomDark}
            customStyle={{
              margin: 0,
              borderRadius: 0,
              background: 'var(--color-card)',
              fontSize: '12px',
              height: '100%',
              overflow: 'auto',
            }}
            wrapLongLines
            showLineNumbers
          >
            {jsonFormatted}
          </SyntaxHighlighter>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-md border h-full w-full flex flex-col">
      <div className="bg-card/90 backdrop-blur-sm border-b border-border/50 p-3 sm:p-4 flex-shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <h3 className="font-medium text-sm sm:text-base">Scraped Elements</h3>
          <div className="flex space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopy(JSON.stringify(result, null, 2), 'all')
                    }
                    className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                  >
                    {copiedItems['all'] ? (
                      <CheckIcon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                    ) : (
                      <ClipboardIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Copy all scraped data</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRaw(true)}
              className="text-xs sm:text-sm"
            >
              View Raw JSON
            </Button>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4 pt-0 flex-1 overflow-y-auto">
        {result &&
          result.elements &&
          result.elements.map((item, index) => (
            <div
              key={index}
              className="mb-4 sm:mb-6 border rounded-md overflow-hidden shadow-sm"
            >
              <div
                className="bg-muted p-2 sm:p-3 flex justify-between items-center cursor-pointer"
                onClick={() => toggleSection(item.selector)}
              >
                <div className="flex items-center min-w-0 flex-1">
                  <span className="mr-2">
                    {expandedSections[item.selector] ? (
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                    ) : (
                      <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                  </span>
                  {item.selector.includes(':not(') ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <code className="text-xs sm:text-sm font-mono bg-accent px-1.5 sm:px-2 py-1 rounded cursor-help truncate">
                            {item.selector.split(':not(')[0]} (filtered)
                          </code>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs max-w-[300px] break-all">
                            {item.selector}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <code className="text-xs sm:text-sm font-mono bg-accent px-1.5 sm:px-2 py-1 rounded truncate">
                      {item.selector}
                    </code>
                  )}
                  <span className="ml-2 text-xs sm:text-sm text-muted-foreground">
                    ({item.results.length}{' '}
                    {item.results.length === 1 ? 'result' : 'results'})
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
                          handleCopy(
                            JSON.stringify(item.results, null, 2),
                            `item-${index}`,
                          );
                        }}
                        className="h-6 w-6 sm:h-8 sm:w-8 p-0 ml-2"
                      >
                        {copiedItems[`item-${index}`] ? (
                          <CheckIcon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                        ) : (
                          <ClipboardIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Copy results for this selector</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {expandedSections[item.selector] && (
                <div className="divide-y divide-border">
                  {item.results.map((result, resultIndex) => {
                    const resultId = `${item.selector}-${resultIndex}`;

                    // Find the class attribute if it exists
                    const classAttribute = result.attributes.find(
                      (attr) => attr.name === 'class',
                    );

                    // Format HTML with highlighted class attributes for consistency
                    const formattedHtml = result.html.replace(
                      /class="([^"]*)"/g,
                      '<span class="text-primary">class</span>=<span class="text-primary/80">"$1"</span>',
                    );

                    return (
                      <div
                        key={resultIndex}
                        className="p-3 sm:p-4 bg-background hover:bg-muted/40"
                      >
                        {/* Main text highlight section */}
                        {result.text && (
                          <div className="mb-3 bg-accent/30 p-2 sm:p-3 rounded-md border border-border">
                            <div className="flex items-center mb-1">
                              <Type className="h-3 w-3 sm:h-4 sm:w-4 text-primary mr-2" />
                              <span className="text-xs sm:text-sm font-medium text-primary">
                                Text Content
                              </span>
                            </div>
                            <p className="text-foreground font-medium break-words text-sm sm:text-base">
                              {result.text || (
                                <span className="text-muted-foreground italic">
                                  No text content
                                </span>
                              )}
                            </p>
                          </div>
                        )}

                        {/* Attributes dropdown */}
                        {result.attributes.length > 0 && (
                          <div className="mb-3">
                            <button
                              onClick={() => toggleAttributes(resultId)}
                              className="flex items-center text-xs sm:text-sm text-foreground bg-accent/20 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md w-full"
                            >
                              <Info className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                              <span className="font-medium">
                                Attributes of this element
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({result.attributes.length})
                              </span>
                              <span className="ml-auto">
                                {expandedAttributes[resultId] ? (
                                  <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4" />
                                )}
                              </span>
                            </button>

                            {expandedAttributes[resultId] && (
                              <div className="mt-2 bg-muted/50 p-2 sm:p-3 rounded-md border border-border">
                                <div className="grid grid-cols-1 gap-2">
                                  {result.attributes.map((attr, attrIndex) => (
                                    <div
                                      key={attrIndex}
                                      className="bg-card p-2 rounded border text-xs"
                                    >
                                      <span className="font-medium text-foreground">
                                        {attr.name}:
                                      </span>
                                      {attr.name === 'class' ? (
                                        <div className="mt-1 pl-2 sm:pl-4 border-l-2 border-primary/20">
                                          {attr.value
                                            .split(' ')
                                            .map((cls, i) => (
                                              <span
                                                key={i}
                                                className="inline-block bg-accent/20 text-accent-foreground px-1 py-0.5 rounded mr-1 mb-1 text-xs"
                                              >
                                                {cls}
                                              </span>
                                            ))}
                                        </div>
                                      ) : (
                                        <span className="ml-1 text-foreground break-all">
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
                        <details className="text-xs bg-muted rounded-md">
                          <summary className="cursor-pointer p-2 flex items-center text-xs sm:text-sm font-medium text-foreground hover:text-primary">
                            <Layers className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                            Complete HTML (including nested elements)
                          </summary>
                          <div className="bg-card rounded-b-md overflow-x-auto">
                            <div className="p-2 sm:p-3">
                              <code
                                className="whitespace-pre-wrap block text-foreground text-xs"
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
          <div className="text-center p-4 sm:p-6 text-muted-foreground">
            <Layers className="h-8 w-8 sm:h-10 sm:w-10 lg:h-12 lg:w-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm sm:text-base">
              No elements found matching your selectors.
            </p>
            <p className="text-xs sm:text-sm mt-1">
              Try different selectors or URL parameters.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface YouTubeCaptionsDisplayProps {
  result: YouTubeCaptionsResult;
}

function YouTubeCaptionsDisplay({ result }: YouTubeCaptionsDisplayProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCaptions, setFilteredCaptions] = useState(result.captions);
  const [selectedCaption, setSelectedCaption] = useState<number | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Filter captions based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCaptions(result.captions);
    } else {
      const filtered = result.captions.filter((caption) =>
        caption.text.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setFilteredCaptions(filtered);
    }
  }, [searchTerm, result.captions]);

  // Clear copied text after 2 seconds
  useEffect(() => {
    if (copiedText) {
      const timer = setTimeout(() => setCopiedText(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedText]);

  const formatTime = (start: string) => {
    const seconds = parseFloat(start);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate gap between consecutive captions
  const getCaptionGap = (currentIndex: number) => {
    if (currentIndex === 0) return null;

    const currentCaption = filteredCaptions[currentIndex];
    const previousCaption = filteredCaptions[currentIndex - 1];

    const currentStart = parseFloat(currentCaption.start);
    const previousStart = parseFloat(previousCaption.start);
    const previousDuration = parseFloat(previousCaption.dur || '0');

    const previousEndTime = previousStart + previousDuration;
    const gap = currentStart - previousEndTime;

    // Only show gaps that are significant (more than 1 second)
    if (gap > 1) {
      return {
        duration: gap,
        startTime: previousEndTime,
        endTime: currentStart,
      };
    }

    return null;
  };

  const getYouTubeUrl = (videoId: string, time?: string) => {
    const baseUrl = `https://www.youtube.com/watch?v=${videoId}`;
    if (time) {
      return `${baseUrl}&t=${Math.floor(parseFloat(time))}s`;
    }
    return baseUrl;
  };

  const copyWithFeedback = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(label);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const copyAsText = () => {
    const text = filteredCaptions
      .map((c) => `[${formatTime(c.start)}] ${c.text}`)
      .join('\n\n');
    copyWithFeedback(text, 'Text copied!');
  };

  const copyAsSRT = () => {
    let srtContent = '';
    filteredCaptions.forEach((caption, index) => {
      const startTime = parseFloat(caption.start);
      const endTime = startTime + (caption.dur ? parseFloat(caption.dur) : 5); // Default 5 seconds if no duration

      const formatSRTTime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
      };

      srtContent += `${index + 1}\n`;
      srtContent += `${formatSRTTime(startTime)} --> ${formatSRTTime(endTime)}\n`;
      srtContent += `${caption.text}\n\n`;
    });

    copyWithFeedback(srtContent, 'SRT copied!');
  };

  const highlightSearchTerm = (text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text;

    const regex = new RegExp(
      `(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi',
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  return (
    <div className="bg-card p-4 sm:p-6 rounded-lg border shadow-sm overflow-hidden w-full relative flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-50 dark:bg-red-950 rounded-lg">
            <Youtube className="h-5 w-5 sm:h-6 sm:w-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              YouTube Captions
            </h3>
            <p className="text-sm text-muted-foreground">
              Interactive Transcript
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={getYouTubeUrl(result.videoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 rounded-md transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            Watch Video
          </a>
          <CopyButton content={JSON.stringify(result, null, 2)} inline />
        </div>
      </div>

      {/* Transcript Stats - Moved to top */}
      <div className="mb-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
        <h4 className="font-semibold text-sm mb-3 text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Transcript Stats
        </h4>
        <div className="grid grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-xl font-bold text-primary">
              {result.metadata.totalCaptions}
            </div>
            <div className="text-xs text-muted-foreground">Total Captions</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-primary">
              {result.language.toUpperCase()}
            </div>
            <div className="text-xs text-muted-foreground">Language</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-mono font-semibold text-primary rounded">
              {result.videoId}
            </div>
            <div className="text-xs text-muted-foreground">Video ID</div>
          </div>
        </div>
      </div>

      {/* Video Details */}
      {result.videoDetails && (
        <div className="mb-6 p-4 bg-muted/30 rounded-lg border border-border">
          <h4 className="font-semibold text-sm mb-3 text-foreground flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            Video Information
          </h4>
          <div className="space-y-3">
            <div>
              <h5 className="text-md font-bold text-foreground mb-1">Title</h5>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {result.videoDetails.title}
              </p>
            </div>
            {result.videoDetails.description && (
              <div>
                <h5 className="text-md font-bold text-foreground mb-1">
                  Description
                </h5>
                <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                  {result.videoDetails.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      {result.captions.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search through captions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-sm bg-background border-muted focus:border-primary"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchTerm && (
            <p className="text-xs text-muted-foreground mt-2">
              Found {filteredCaptions.length} caption
              {filteredCaptions.length !== 1 ? 's' : ''} matching "{searchTerm}"
            </p>
          )}
        </div>
      )}

      {/* Captions List */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-3">
          {filteredCaptions.length > 0 ? (
            filteredCaptions.map((caption, index) => {
              const gap = getCaptionGap(index);
              return (
                <div key={`caption-container-${index}`}>
                  {/* Gap Indicator */}
                  {gap && (
                    <div className="flex items-center justify-center py-2">
                      <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/30 rounded-full text-xs text-amber-700 dark:text-amber-300">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                        <span className="font-medium">
                          {gap.duration.toFixed(1)}s gap
                        </span>
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                  )}

                  {/* Caption */}
                  <div
                    className={`group p-4 rounded-lg border transition-all duration-200 cursor-pointer ${
                      selectedCaption === index
                        ? 'bg-primary/5 border-primary/30 shadow-sm'
                        : 'bg-card hover:bg-muted/30 border-border hover:border-muted-foreground/20'
                    }`}
                    onClick={() =>
                      setSelectedCaption(
                        selectedCaption === index ? null : index,
                      )
                    }
                  >
                    <div className="flex items-start gap-4">
                      <a
                        href={getYouTubeUrl(result.videoId, caption.start)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 rounded-md transition-colors group-hover:bg-primary/15">
                          <Play className="h-3 w-3 text-primary" />
                          <span className="text-xs font-mono font-medium text-primary">
                            {formatTime(caption.start)}
                          </span>
                        </div>
                      </a>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-relaxed text-foreground">
                          {searchTerm.trim()
                            ? highlightSearchTerm(caption.text, searchTerm)
                            : caption.text}
                        </p>
                        {caption.dur && (
                          <div className="mt-2 flex items-center gap-2">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">
                              {parseFloat(caption.dur).toFixed(1)}s duration
                            </span>
                          </div>
                        )}
                      </div>
                      {selectedCaption === index && (
                        <div className="flex-shrink-0">
                          <CheckCircle className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <div className="p-4 bg-muted/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Youtube className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                {searchTerm ? 'No matching captions' : 'No captions available'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {searchTerm
                  ? `No captions found matching "${searchTerm}". Try a different search term.`
                  : "This video doesn't have captions available, or they couldn't be extracted."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer with copy options */}
      {filteredCaptions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {filteredCaptions.length}
                </span>
                {filteredCaptions.length !== result.metadata.totalCaptions && (
                  <span> of {result.metadata.totalCaptions}</span>
                )}{' '}
                caption{filteredCaptions.length !== 1 ? 's' : ''}
                {searchTerm && ` matching "${searchTerm}"`}
              </div>
              {copiedText && (
                <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-3 w-3" />
                  <span className="text-xs font-medium">{copiedText}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={copyAsText}
                className="text-xs flex items-center gap-2"
                disabled={!!copiedText}
              >
                <Copy className="h-3 w-3" />
                Copy Text
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={copyAsSRT}
                className="text-xs flex items-center gap-2"
                disabled={!!copiedText}
              >
                <FileText className="h-3 w-3" />
                Copy SRT
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
