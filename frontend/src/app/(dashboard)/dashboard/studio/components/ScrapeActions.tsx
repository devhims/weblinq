import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info as InfoIcon, Plus, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrapeElement, type ScrapeOptions } from '../types';
import { useEffect, useState } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';

interface ScrapeActionsProps {
  selector: string;
  setSelector: (selector: string) => void;
  elements?: ScrapeElement[];
  setElements?: (elements: ScrapeElement[]) => void;
  scrapeOptions?: ScrapeOptions;
  setScrapeOptions?: (options: ScrapeOptions) => void;
}

export function ScrapeActions({
  selector,
  setSelector,
  elements = [],
  setElements = () => {},
  scrapeOptions = {},
  setScrapeOptions = () => {},
}: ScrapeActionsProps) {
  const [selectorInput, setSelectorInput] = useState('');

  const addElement = () => {
    if (selectorInput.trim()) {
      const newSelector = selectorInput.trim();
      if (!elements.some((el) => el.selector === newSelector)) {
        setElements([...elements, { selector: newSelector }]);
        setSelectorInput('');
      }
    }
  };

  const removeElement = (index: number) => {
    const newElements = [...elements];
    newElements.splice(index, 1);
    setElements(newElements);
  };

  useEffect(() => {
    if (elements.length > 0) {
      setSelector(elements.map((el) => el.selector).join(', '));
    }
  }, [elements, setSelector]);

  useEffect(() => {
    // Only run this once when component mounts
    if (
      typeof setScrapeOptions === 'function' &&
      !scrapeOptions.hasOwnProperty('onlyMainContent')
    ) {
      const defaultOptions = {
        ...scrapeOptions,
        onlyMainContent: false, // Default to false
      };
      setScrapeOptions(defaultOptions);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const PRESET_SELECTORS = [
    { label: 'Headings', selector: 'h1, h2, h3' },
    { label: 'Links', selector: 'a' },
    { label: 'Images', selector: 'img' },
    { label: 'Paragraphs', selector: 'p' },
    { label: 'Lists', selector: 'ul, ol' },
  ];

  return (
    <div className='space-y-4 mb-4'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <Label htmlFor='selector-input' className='text-base font-medium'>
            CSS Selector
          </Label>
          <div className='flex space-x-2'>
            <Input
              id='selector-input'
              value={selectorInput}
              onChange={(e) => setSelectorInput(e.target.value)}
              placeholder='h1, .main-content, #header'
              className='flex-1 text-base h-11'
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addElement();
                }
              }}
            />
            <Button onClick={addElement} type='button' className='h-11 w-11'>
              <Plus className='h-5 w-5' />
            </Button>
          </div>
          <p className='text-sm text-muted-foreground mt-1.5'>
            Examples: "h1", ".product-title", "nav a", "#main-content"
          </p>
        </div>
        <div className='mt-2'>
          <p className='text-base text-muted-foreground mb-2'>Quick add:</p>
          <div className='flex flex-wrap gap-2'>
            {PRESET_SELECTORS.map((preset) => (
              <Button
                key={preset.label}
                variant='outline'
                size='sm'
                className='text-base py-2 px-3 h-auto'
                onClick={() => {
                  setSelectorInput(preset.selector);
                  addElement();
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {elements.length > 0 && (
        <div className='mt-4'>
          <Label className='text-base font-medium'>Selected Elements</Label>
          <div className='bg-card border border-border rounded-md p-4 mt-2'>
            {elements.map((element, index) => (
              <div
                key={index}
                className='flex items-center justify-between py-1.5'
              >
                <code className='text-base bg-muted/70 px-2.5 py-1.5 rounded'>
                  {element.selector}
                </code>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => removeElement(index)}
                  className='h-9 w-9 p-0'
                >
                  <X className='h-5 w-5' />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Accordion type='single' collapsible className='w-full'>
        <AccordionItem value='advanced-options'>
          <AccordionTrigger className='text-base'>
            <span className='flex items-center'>
              <Settings className='h-5 w-5 mr-2' />
              Advanced Options
              {Object.keys(scrapeOptions).length > 1 && (
                <Badge variant='outline' className='ml-2'>
                  {Object.keys(scrapeOptions).length - 1} set
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className='space-y-4 pt-2'>
              <div className='flex items-start space-x-2'>
                <Checkbox
                  id='only-main-content'
                  checked={scrapeOptions.onlyMainContent !== false}
                  onCheckedChange={(checked: boolean | 'indeterminate') => {
                    setScrapeOptions({
                      ...scrapeOptions,
                      onlyMainContent: checked === true,
                    });
                  }}
                />
                <div>
                  <Label
                    htmlFor='only-main-content'
                    className='text-base font-medium leading-none cursor-pointer'
                  >
                    Only Main Content
                  </Label>
                  <p className='text-sm text-muted-foreground mt-1.5'>
                    Intelligently filters results to focus on main content
                    areas, removing elements from headers, footers, navigation,
                    sidebars, and ads.
                  </p>
                  <div className='mt-2 text-sm bg-accent/50 p-2.5 rounded border border-border'>
                    <p className='text-foreground'>
                      <InfoIcon className='h-4 w-4 inline-block mr-1.5' />
                      This is a client-side feature that analyzes the returned
                      results to identify and display only main content
                      elements.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

interface ExtendedScrapeActionsProps extends ScrapeActionsProps {
  includeMarkdown?: boolean;
  setIncludeMarkdown?: (includeMarkdown: boolean) => void;
  includeLinks?: boolean;
  setIncludeLinks?: (includeLinks: boolean) => void;
  visibleLinksOnly?: boolean;
  setVisibleLinksOnly?: (visibleLinksOnly: boolean) => void;
}

export function ExtendedScrapeActions({
  selector,
  setSelector,
  elements = [],
  setElements = () => {},
  scrapeOptions = {},
  setScrapeOptions = () => {},
  includeMarkdown = false,
  setIncludeMarkdown = () => {},
  includeLinks = false,
  setIncludeLinks = () => {},
  visibleLinksOnly,
  setVisibleLinksOnly,
}: ExtendedScrapeActionsProps) {
  const searchParams = useSearchParams();

  // Use URL params for initialization if available
  const effectiveIncludeMarkdown =
    typeof includeMarkdown !== 'undefined'
      ? includeMarkdown
      : searchParams.get('includeMarkdown') === 'true';

  const effectiveIncludeLinks =
    typeof includeLinks !== 'undefined'
      ? includeLinks
      : searchParams.get('includeLinks') === 'true';

  const effectiveVisibleLinksOnly =
    typeof visibleLinksOnly !== 'undefined'
      ? visibleLinksOnly
      : searchParams.get('visibleLinksOnly') === 'true';

  return (
    <div className='space-y-4'>
      <ScrapeActions
        selector={selector}
        setSelector={setSelector}
        elements={elements}
        setElements={setElements}
        scrapeOptions={scrapeOptions}
        setScrapeOptions={setScrapeOptions}
      />

      <div className='border-t pt-4 mt-4'>
        <Label className='text-base font-medium'>
          Additional Content to Extract
        </Label>
        <div className='flex flex-col gap-3 mt-2'>
          <div className='flex items-start space-x-2'>
            <Checkbox
              id='include-markdown'
              checked={effectiveIncludeMarkdown}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                setIncludeMarkdown(checked === true)
              }
            />
            <div>
              <Label
                htmlFor='include-markdown'
                className='text-base font-medium leading-none cursor-pointer'
              >
                Include Markdown
              </Label>
              <p className='text-sm text-muted-foreground mt-1.5'>
                Extract the page content as Markdown along with the selected
                elements
              </p>
            </div>
          </div>

          <div className='flex items-start space-x-2'>
            <Checkbox
              id='include-links'
              checked={effectiveIncludeLinks}
              onCheckedChange={(checked: boolean | 'indeterminate') =>
                setIncludeLinks(checked === true)
              }
            />
            <div>
              <Label
                htmlFor='include-links'
                className='text-base font-medium leading-none cursor-pointer'
              >
                Include Links
              </Label>
              <p className='text-sm text-muted-foreground mt-1.5'>
                Extract all links from the page along with the selected elements
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface LinkActionsProps {
  visibleLinksOnly: boolean;
  setVisibleLinksOnly: (visibleLinksOnly: boolean) => void;
}

export function LinkActions({
  visibleLinksOnly,
  setVisibleLinksOnly,
}: LinkActionsProps) {
  const searchParams = useSearchParams();

  // Use URL param if prop is not provided
  const effectiveVisibleLinksOnly =
    typeof visibleLinksOnly !== 'undefined'
      ? visibleLinksOnly
      : searchParams.get('visibleLinksOnly') === 'true';

  return (
    <div className='space-y-4 mb-4'>
      <div className='flex items-start space-x-2'>
        <Checkbox
          id='visible-links-only'
          checked={effectiveVisibleLinksOnly}
          onCheckedChange={(checked: boolean | 'indeterminate') =>
            setVisibleLinksOnly(checked === true)
          }
          className='h-5 w-5 mt-1'
        />
        <div>
          <Label
            htmlFor='visible-links-only'
            className='text-base font-medium leading-none cursor-pointer'
          >
            Visible Links Only
          </Label>
          <p className='text-base text-muted-foreground mt-1.5'>
            Only retrieve links that are visible on the page
          </p>
        </div>
      </div>
    </div>
  );
}

// ScrapeMarkdownActions: no options needed
export function ScrapeMarkdownActions() {
  return null;
}

// ScrapeHtmlActions: no options needed
export function ScrapeHtmlActions() {
  return null;
}

// ScrapeLinksActions: manage visibleLinksOnly state locally
export function ScrapeLinksActions() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Initialize state from URL params
  const [visibleLinksOnly, setVisibleLinksOnly] = useState(
    searchParams.get('visibleLinksOnly') === 'true'
  );

  // Update URL params when state changes
  const handleVisibleLinksChange = (checked: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (checked) {
      params.set('visibleLinksOnly', 'true');
    } else {
      params.delete('visibleLinksOnly');
    }
    router.replace(`${pathname}?${params.toString()}`);
    setVisibleLinksOnly(checked);
  };

  return (
    <div className='space-y-4 mb-4'>
      <div className='flex items-start space-x-2'>
        <Checkbox
          id='visible-links-only'
          checked={visibleLinksOnly}
          onCheckedChange={(checked: boolean | 'indeterminate') =>
            handleVisibleLinksChange(checked === true)
          }
          className='h-5 w-5 mt-1'
        />
        <div>
          <Label
            htmlFor='visible-links-only'
            className='text-base font-medium leading-none cursor-pointer'
          >
            Visible Links Only
          </Label>
          <p className='text-base text-muted-foreground mt-1.5'>
            Only retrieve links that are visible on the page
          </p>
        </div>
      </div>
    </div>
  );
}

// ScrapeElementsActions: initialize state internally, not requiring it via props
export function ScrapeElementsActions() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Initialize state from URL params
  const selector = searchParams.get('selector') || '';
  const elementsFromParams = selector
    ? selector.split(',').map((s) => ({ selector: s.trim() }))
    : [];

  // State variables
  const [elements, setElements] = useState(elementsFromParams);
  const [selectorInput, setSelectorInput] = useState(
    searchParams.get('selectorInput') || ''
  );
  const [onlyMainContent, setOnlyMainContent] = useState(
    searchParams.get('onlyMainContent') === 'true'
  );
  const [includeMarkdown, setIncludeMarkdown] = useState(
    searchParams.get('includeMarkdown') === 'true'
  );
  const [includeLinks, setIncludeLinks] = useState(
    searchParams.get('includeLinks') === 'true'
  );
  const [visibleLinksOnly, setVisibleLinksOnly] = useState(
    searchParams.get('visibleLinksOnly') === 'true'
  );

  // Update URL params when state changes
  const updateSearchParams = (updates: Record<string, any>) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === false) {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    router.replace(`${pathname}?${params.toString()}`);
  };

  // Add element to elements list
  const addElement = () => {
    if (selectorInput.trim()) {
      const newSelector = selectorInput.trim();
      if (!elements.some((el) => el.selector === newSelector)) {
        const newElements = [...elements, { selector: newSelector }];
        setElements(newElements);
        setSelectorInput('');
        updateSearchParams({
          selector: newElements.map((el) => el.selector).join(', '),
        });
      }
    }
  };

  // Remove element from elements list
  const removeElement = (index: number) => {
    const newElements = [...elements];
    newElements.splice(index, 1);
    setElements(newElements);
    updateSearchParams({
      selector: newElements.map((el) => el.selector).join(', '),
    });
  };

  // Handle checkbox changes
  const handleOptionChange = (option: string, value: boolean) => {
    const updates: Record<string, any> = {};

    switch (option) {
      case 'onlyMainContent':
        setOnlyMainContent(value);
        if (value) {
          updates.onlyMainContent = 'true';
        } else {
          updates.onlyMainContent = undefined; // will be deleted
        }
        break;
      case 'includeMarkdown':
        setIncludeMarkdown(value);
        if (value) {
          updates.includeMarkdown = 'true';
        } else {
          updates.includeMarkdown = undefined;
        }
        break;
      case 'includeLinks':
        setIncludeLinks(value);
        if (value) {
          updates.includeLinks = 'true';
          // Preserve visibleLinksOnly if it was previously set
          if (visibleLinksOnly) {
            updates.visibleLinksOnly = 'true';
          }
        } else {
          updates.includeLinks = undefined;
          setVisibleLinksOnly(false);
          updates.visibleLinksOnly = undefined;
        }
        break;
      case 'visibleLinksOnly':
        setVisibleLinksOnly(value);
        if (value && includeLinks) {
          updates.visibleLinksOnly = 'true';
        } else {
          updates.visibleLinksOnly = undefined;
        }
        break;
    }

    updateSearchParams(updates);
  };

  // Preset selectors
  const PRESET_SELECTORS = [
    { label: 'Headings', selector: 'h1, h2, h3' },
    { label: 'Links', selector: 'a' },
    { label: 'Images', selector: 'img' },
    { label: 'Paragraphs', selector: 'p' },
    { label: 'Lists', selector: 'ul, ol' },
  ];

  return (
    <div className='space-y-4 mb-4'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div>
          <Label htmlFor='selector-input' className='text-base font-medium'>
            CSS Selector
          </Label>
          <div className='flex space-x-2'>
            <Input
              id='selector-input'
              value={selectorInput}
              onChange={(e) => setSelectorInput(e.target.value)}
              placeholder='h1, .main-content, #header'
              className='flex-1 text-base h-11'
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addElement();
                }
              }}
            />
            <Button onClick={addElement} type='button' className='h-11 w-11'>
              <Plus className='h-5 w-5' />
            </Button>
          </div>
          <p className='text-sm text-muted-foreground mt-1.5'>
            Examples: "h1", ".product-title", "nav a", "#main-content"
          </p>
        </div>
        <div className='mt-2'>
          <p className='text-base text-muted-foreground mb-2'>Quick add:</p>
          <div className='flex flex-wrap gap-2'>
            {PRESET_SELECTORS.map((preset) => (
              <Button
                key={preset.label}
                variant='outline'
                size='sm'
                className='text-base py-2 px-3 h-auto'
                onClick={() => {
                  setSelectorInput(preset.selector);
                  addElement();
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {elements.length > 0 && (
        <div className='mt-4'>
          <Label className='text-base font-medium'>Selected Elements</Label>
          <div className='bg-card border border-border rounded-md p-4 mt-2'>
            {elements.map((element, index) => (
              <div
                key={index}
                className='flex items-center justify-between py-1.5'
              >
                <code className='text-base bg-muted/70 px-2.5 py-1.5 rounded'>
                  {element.selector}
                </code>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => removeElement(index)}
                  className='h-9 w-9 p-0'
                >
                  <X className='h-5 w-5' />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Accordion type='single' collapsible className='w-full'>
        <AccordionItem value='advanced-options'>
          <AccordionTrigger className='text-base'>
            <span className='flex items-center'>
              <Settings className='h-5 w-5 mr-2' />
              Advanced Options
              {(onlyMainContent || includeMarkdown || includeLinks) && (
                <Badge variant='outline' className='ml-2'>
                  {[
                    onlyMainContent ? 'Main Content' : null,
                    includeMarkdown ? 'Markdown' : null,
                    includeLinks ? 'Links' : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className='space-y-4 pt-2'>
              <div className='flex items-start space-x-2'>
                <Checkbox
                  id='only-main-content'
                  checked={onlyMainContent}
                  onCheckedChange={(checked: boolean | 'indeterminate') => {
                    handleOptionChange('onlyMainContent', checked === true);
                  }}
                />
                <div>
                  <Label
                    htmlFor='only-main-content'
                    className='text-base font-medium leading-none cursor-pointer'
                  >
                    Only Main Content
                  </Label>
                  <p className='text-sm text-muted-foreground mt-1.5'>
                    Intelligently filters results to focus on main content
                    areas, removing elements from headers, footers, navigation,
                    sidebars, and ads.
                  </p>
                  <div className='mt-2 text-sm bg-accent/50 p-2.5 rounded border border-border'>
                    <p className='text-foreground'>
                      <InfoIcon className='h-4 w-4 inline-block mr-1.5' />
                      This is a client-side feature that analyzes the returned
                      results to identify and display only main content
                      elements.
                    </p>
                  </div>
                </div>
              </div>
              <div className='flex items-start space-x-2'>
                <Checkbox
                  id='include-markdown'
                  checked={includeMarkdown}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    handleOptionChange('includeMarkdown', checked === true)
                  }
                />
                <div>
                  <Label
                    htmlFor='include-markdown'
                    className='text-base font-medium leading-none cursor-pointer'
                  >
                    Include Markdown
                  </Label>
                  <p className='text-sm text-muted-foreground mt-1.5'>
                    Extract the page content as Markdown along with the selected
                    elements
                  </p>
                </div>
              </div>
              <div className='flex items-start space-x-2'>
                <Checkbox
                  id='include-links'
                  checked={includeLinks}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    handleOptionChange('includeLinks', checked === true)
                  }
                />
                <div>
                  <Label
                    htmlFor='include-links'
                    className='text-base font-medium leading-none cursor-pointer'
                  >
                    Include Links
                  </Label>
                  <p className='text-sm text-muted-foreground mt-1.5'>
                    Extract all links from the page along with the selected
                    elements
                  </p>
                </div>
              </div>
              {includeLinks && (
                <div className='flex items-start space-x-2'>
                  <Checkbox
                    id='visible-links-only'
                    checked={visibleLinksOnly}
                    onCheckedChange={(checked: boolean | 'indeterminate') =>
                      handleOptionChange('visibleLinksOnly', checked === true)
                    }
                    className='h-5 w-5 mt-1'
                  />
                  <div>
                    <Label
                      htmlFor='visible-links-only'
                      className='text-base font-medium leading-none cursor-pointer'
                    >
                      Visible Links Only
                    </Label>
                    <p className='text-base text-muted-foreground mt-1.5'>
                      Only retrieve links that are visible on the page
                    </p>
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
