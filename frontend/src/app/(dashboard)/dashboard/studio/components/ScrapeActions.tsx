'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Info as InfoIcon, Plus, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';
import { useQueryState, parseAsBoolean, parseAsInteger } from 'nuqs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import React from 'react';

// Updated ScrapeMarkdownActions with advanced options
export function ScrapeMarkdownActions() {
  const [waitTime, setWaitTime] = useQueryState('waitTime', parseAsInteger);

  const handleWaitTimeChange = (value: string) => {
    if (value.trim() === '') {
      setWaitTime(0);
    } else {
      const num = Number(value);
      if (!isNaN(num) && num >= 0 && num <= 5000) {
        setWaitTime(num);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced-options">
          <AccordionTrigger className="text-base">
            <span className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Advanced Options
              {waitTime && waitTime > 0 && (
                <Badge variant="outline" className="ml-2">
                  Wait: {waitTime}ms
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="flex items-start space-x-2">
                <div className="flex-1">
                  <Label htmlFor="wait-time" className="text-base font-medium leading-none">
                    Wait Time (ms)
                  </Label>
                  <Input
                    id="wait-time"
                    type="number"
                    value={waitTime?.toString() ?? ''}
                    onChange={(e) => handleWaitTimeChange(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="5000"
                    className="mt-2 text-base h-11 max-w-sm"
                  />
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Additional time to wait for content to load before extracting markdown (0-5000ms)
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// ScrapeHtmlActions: no options needed
export function ScrapeHtmlActions() {
  const [waitTime, setWaitTime] = useQueryState('waitTime', parseAsInteger);

  const handleWaitTimeChange = (value: string) => {
    if (value.trim() === '') {
      setWaitTime(0);
    } else {
      const num = Number(value);
      if (!isNaN(num) && num >= 0 && num <= 5000) {
        setWaitTime(num);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced-options">
          <AccordionTrigger className="text-base">
            <span className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Advanced Options
              {waitTime && waitTime > 0 && (
                <Badge variant="outline" className="ml-2">
                  Wait: {waitTime}ms
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="flex items-start space-x-2">
                <div className="flex-1">
                  <Label htmlFor="wait-time-html" className="text-base font-medium leading-none">
                    Wait Time (ms)
                  </Label>
                  <Input
                    id="wait-time-html"
                    type="number"
                    value={waitTime?.toString() ?? ''}
                    onChange={(e) => handleWaitTimeChange(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="5000"
                    className="mt-2 text-base h-11 max-w-sm"
                  />
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Additional time to wait for content to load before fetching HTML (0-5000ms)
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// THIRD_EDIT: Refactor ScrapeLinksActions with nuqs to control `includeExternal` flag
// THIRD_EDIT: Refactor ScrapeLinksActions with responsive layout
export function ScrapeLinksActions() {
  // URL-backed state
  const [waitTime, setWaitTime] = useQueryState('waitTime', parseAsInteger);
  const [includeExternal, setIncludeExternal] = useQueryState('includeExternal', parseAsBoolean);
  const [visibleLinksOnly, setVisibleLinksOnly] = useQueryState('visibleLinksOnly', parseAsBoolean);

  /* ———————————————————————————————————————————
     Handlers
  ——————————————————————————————————————————— */
  const handleWaitTimeChange = (value: string) => {
    if (value.trim() === '') {
      setWaitTime(0);
    } else {
      const num = Number(value);
      if (!isNaN(num) && num >= 0 && num <= 5000) {
        setWaitTime(num);
      }
    }
  };

  const handleIncludeExternalChange = (checked: boolean) => setIncludeExternal(checked ? true : false);
  const handleVisibleLinksChange = (checked: boolean) => setVisibleLinksOnly(checked ? true : null);

  // Derived
  const effectiveIncludeExternal = includeExternal !== false; // default true

  /* ———————————————————————————————————————————
     Render
  ——————————————————————————————————————————— */
  return (
    <div className="space-y-4">
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced-options">
          <AccordionTrigger className="text-base">
            <span className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Advanced Options
              {((waitTime && waitTime > 0) || !effectiveIncludeExternal || visibleLinksOnly) && (
                <Badge variant="outline" className="ml-2">
                  {[
                    waitTime && waitTime > 0 ? `Wait: ${waitTime}ms` : null,
                    effectiveIncludeExternal ? null : 'Internal Only',
                    visibleLinksOnly ? 'Visible Only' : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6 pt-2">
              {/* Wait Time */}
              <div className="flex items-start space-x-2">
                <div className="flex-1">
                  <Label htmlFor="wait-time-links" className="text-base font-medium leading-none">
                    Wait Time (ms)
                  </Label>
                  <Input
                    id="wait-time-links"
                    type="number"
                    value={waitTime?.toString() ?? ''}
                    onChange={(e) => handleWaitTimeChange(e.target.value)}
                    placeholder="0"
                    min="0"
                    max="5000"
                    className="mt-2 text-base h-11 max-w-sm"
                  />
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Additional time to wait for links to load before extraction (0-5000ms)
                  </p>
                </div>
              </div>

              {/* Include External */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="include-external-links"
                  checked={effectiveIncludeExternal}
                  onCheckedChange={(c) => handleIncludeExternalChange(c === true)}
                  className="h-5 w-5 mt-1"
                />
                <div>
                  <Label htmlFor="include-external-links" className="text-base font-medium leading-none cursor-pointer">
                    Include External Links
                  </Label>
                  <p className="text-base text-muted-foreground mt-1.5">
                    When unchecked, only links to the same domain will be returned
                  </p>
                </div>
              </div>

              {/* Visible Links Only */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="visible-links-only"
                  checked={visibleLinksOnly ?? false}
                  onCheckedChange={(c) => handleVisibleLinksChange(c === true)}
                  className="h-5 w-5 mt-1"
                />
                <div>
                  <Label htmlFor="visible-links-only" className="text-base font-medium leading-none cursor-pointer">
                    Visible Links Only
                  </Label>
                  <p className="text-base text-muted-foreground mt-1.5">
                    Filters out links hidden via CSS/display properties
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// FOURTH_EDIT: Refactor ScrapeElementsActions with nuqs and replace visibleLinksOnly with includeExternal
export function ScrapeElementsActions() {
  /* ———————————————————————————————————————————
     URL-backed state (nuqs)
  ——————————————————————————————————————————— */
  const [selectorRaw, setSelectorRaw] = useQueryState('selector', { defaultValue: '' });
  const [onlyMainContent, setOnlyMainContent] = useQueryState('onlyMainContent', parseAsBoolean);
  const [includeMarkdown, setIncludeMarkdown] = useQueryState('includeMarkdown', parseAsBoolean);

  /* ———————————————————————————————————————————
     Local UI state (not stored in URL)
  ——————————————————————————————————————————— */
  const [selectorInput, setSelectorInput] = useState('');

  /* ———————————————————————————————————————————
     Derived state
  ——————————————————————————————————————————— */
  const elements = React.useMemo(() => {
    return selectorRaw
      ? selectorRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((selector) => ({ selector }))
      : [];
  }, [selectorRaw]);

  /* ———————————————————————————————————————————
     Helpers
  ——————————————————————————————————————————— */
  const updateElements = (newElements: { selector: string }[]) => {
    const serialized = newElements.map((el) => el.selector).join(', ');
    if (serialized) {
      setSelectorRaw(serialized);
    } else {
      setSelectorRaw(null);
    }
  };

  const addElement = () => {
    const raw = selectorInput.trim();
    if (!raw) return;
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const currentSelectors = new Set(elements.map((el) => el.selector));
    parts.forEach((sel) => currentSelectors.add(sel));
    updateElements(Array.from(currentSelectors).map((s) => ({ selector: s })));
    setSelectorInput('');
  };

  const removeElement = (index: number) => {
    const newElements = elements.filter((_, i) => i !== index);
    updateElements(newElements);
  };

  const handlePresetClick = (presetSel: string) => {
    const parts = presetSel
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const currentSelectors = new Set(elements.map((el) => el.selector));
    parts.forEach((sel) => currentSelectors.add(sel));
    updateElements(Array.from(currentSelectors).map((s) => ({ selector: s })));
  };

  const handleOptionChange = (option: string, value: boolean) => {
    switch (option) {
      case 'onlyMainContent':
        if (value) setOnlyMainContent(true);
        else setOnlyMainContent(null);
        break;
      case 'includeMarkdown':
        if (value) setIncludeMarkdown(true);
        else setIncludeMarkdown(null);
        break;
    }
  };

  /* ———————————————————————————————————————————
     Preset selectors
  ——————————————————————————————————————————— */
  const PRESET_SELECTORS = [
    { label: 'Headings', selector: 'h1, h2, h3' },
    { label: 'Links', selector: 'a' },
    { label: 'Images', selector: 'img' },
    { label: 'Paragraphs', selector: 'p' },
    { label: 'Lists', selector: 'ul, ol' },
  ];

  /* ———————————————————————————————————————————
     Render
  ——————————————————————————————————————————— */
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-x-4 gap-y-2 items-start">
        {/* Row 1 — headings (aligned) */}
        <Label htmlFor="selector-input" className="text-base font-medium">
          CSS Selector
        </Label>
        <p className="text-base font-medium text-muted-foreground">Quick add</p>

        {/* Row 2 — input / plus & quick-add buttons (aligned) */}
        <div className="flex space-x-2">
          <Input
            id="selector-input"
            value={selectorInput}
            onChange={(e) => setSelectorInput(e.target.value)}
            placeholder="h1, .main-content, #header"
            className="flex-1 h-11 text-base"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addElement();
              }
            }}
          />
          <Button onClick={addElement} type="button" className="h-11 w-11 p-0">
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESET_SELECTORS.map((preset) => (
            <Button
              key={preset.label}
              variant="outline"
              size="sm"
              className="text-base py-2 px-3 h-auto"
              onClick={() => handlePresetClick(preset.selector)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {/* Row 3 — example helper text spans both columns */}
        <p className="text-sm text-muted-foreground mt-1.5 md:col-span-2">
          Examples:&nbsp;“h1”, “.product-title”, “nav a”, “#main-content”
        </p>
      </div>

      {elements.length > 0 && (
        <div className="mt-4">
          <Label className="text-base font-medium">Selected Elements</Label>
          <div className="bg-card border border-border rounded-md p-4 mt-2">
            {elements.map((element, index) => (
              <div key={index} className="flex items-center justify-between py-1.5">
                <code className="text-base bg-muted/70 px-2.5 py-1.5 rounded">{element.selector}</code>
                <Button variant="ghost" size="sm" onClick={() => removeElement(index)} className="h-9 w-9 p-0">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced-options">
          <AccordionTrigger className="text-base">
            <span className="flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Advanced Options
              {(onlyMainContent || includeMarkdown) && (
                <Badge variant="outline" className="ml-2">
                  {[onlyMainContent ? 'Main Content' : null, includeMarkdown ? 'Markdown' : null]
                    .filter(Boolean)
                    .join(', ')}
                </Badge>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="only-main-content"
                  checked={onlyMainContent ?? false}
                  className="h-5 w-5 mt-[2px]"
                  onCheckedChange={(c: boolean | 'indeterminate') => handleOptionChange('onlyMainContent', c === true)}
                />
                <div>
                  <Label htmlFor="only-main-content" className="text-base font-medium leading-none cursor-pointer">
                    Only Main Content
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Intelligently filters results to focus on main content areas, removing elements from headers,
                    footers, navigation, sidebars, and ads.
                  </p>
                  <div className="mt-2 text-sm bg-accent/50 p-2.5 rounded border border-border">
                    <p className="text-foreground">
                      <InfoIcon className="h-4 w-4 inline-block mr-1.5" />
                      This is a client-side feature that analyzes the returned results to identify and display only main
                      content elements.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="include-markdown"
                  checked={includeMarkdown ?? false}
                  className="h-5 w-5 mt-[2px]"
                  onCheckedChange={(c: boolean | 'indeterminate') => handleOptionChange('includeMarkdown', c === true)}
                />
                <div>
                  <Label htmlFor="include-markdown" className="text-base font-medium leading-none cursor-pointer">
                    Include Markdown
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1.5">
                    Extract the page content as Markdown along with the selected elements
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
