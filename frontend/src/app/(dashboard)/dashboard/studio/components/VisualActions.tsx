'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';
import { useQueryState, parseAsInteger } from 'nuqs';
import { useStudioParams } from '../hooks/useStudioParams';

export function ScreenshotActions() {
  /* ───── Simplified nuqs state ───────────────────────────── */
  const {
    format,
    setFormat,
    quality,
    setQuality,
    fullPage,
    setFullPage,
    mobile,
    setMobile,
    device,
    setDevice,
    width,
    setWidth,
    height,
    setHeight,
  } = useStudioParams();

  /* ───── wait time param (nuqs) ─────────────────────── */
  const [waitTime, setWaitTime] = useQueryState('waitTime', parseAsInteger);

  /* ───── helpers ───────────────────────────────────── */
  const toggleMobile = (checked: boolean) => {
    setMobile(checked);
    if (!checked) setDevice(null); // remove from URL
    else if (device === null) setDevice('iphone15'); // restore default
  };

  const setCaptureRange = (range: 'viewport' | 'fullpage') => setFullPage(range === 'fullpage');

  /* ───── static lists ───────────────────────────────── */
  /* ─── static data ─────────────────────────────────── */
  const formats = [
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WEBP' },
  ];

  const devices = [
    { value: 'iphone15', label: 'iPhone 15' },
    { value: 'galaxyS24', label: 'Galaxy S24' },
  ];

  /* ───── UI ─────────────────────────────────────────── */
  return (
    <div className="flex flex-col gap-6 mb-4 p-4 border rounded-lg bg-muted/30">
      {/* ① Image format + quality */}
      <section>
        <Label className="text-base font-semibold mb-1 block">Image Format</Label>
        <div className="flex flex-row gap-3 mt-2">
          {formats.map((f) => (
            <button
              key={f.value}
              onClick={() => setFormat(f.value)}
              aria-pressed={format === f.value}
              className={`px-4 py-2 rounded border text-base font-medium transition-all
                ${
                  format === f.value
                    ? 'bg-primary text-white border-primary shadow'
                    : 'bg-background border-border text-foreground hover:bg-muted'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {(format === 'jpeg' || format === 'webp') && (
          <div className="mt-4 max-w-xs">
            <Label htmlFor="quality" className="text-base font-medium mb-1 block">
              Image Quality
            </Label>
            <Slider
              id="quality"
              min={1}
              max={100}
              step={1}
              value={[quality]}
              onValueChange={(v) => setQuality(v[0])} // debounce if needed
            />
            <div className="flex justify-between text-sm mt-1">
              <span>1</span>
              <span className="text-center">Current: {quality}</span>
              <span>100</span>
            </div>
          </div>
        )}
      </section>

      {/* ② Capture range (applies everywhere) */}
      <section className="max-w-xs">
        <Label className="text-base font-semibold block mb-1">Capture range</Label>
        <div className="flex gap-3 mt-2">
          {(['fullpage', 'viewport'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setCaptureRange(r)}
              className={`px-4 py-2 rounded border text-base font-medium transition-all
                ${
                  fullPage === (r === 'fullpage')
                    ? 'bg-primary text-white border-primary shadow'
                    : 'bg-background border-border text-foreground hover:bg-muted'
                }`}
            >
              {r === 'viewport' ? 'Viewport' : 'Full page'}
            </button>
          ))}
        </div>
      </section>

      {/* ③ Advanced options */}
      <section className="max-w-sm w-full">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="advanced-options">
            <AccordionTrigger className="text-base">
              <span className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Advanced Options
                {(waitTime && waitTime > 0) || mobile || width || height ? (
                  <Badge variant="outline" className="ml-2">
                    {[
                      waitTime && waitTime > 0 ? `Wait: ${waitTime}ms` : null,
                      mobile ? 'Mobile' : null,
                      width ? `W: ${width}` : null,
                      height ? `H: ${height}` : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </Badge>
                ) : null}
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 pt-2">
                {/* Wait Time */}
                <div className="flex items-start space-x-2">
                  <div className="flex-1">
                    <Label htmlFor="wait-time-screenshot" className="text-base font-medium leading-none">
                      Wait Time (ms)
                    </Label>
                    <Input
                      id="wait-time-screenshot"
                      type="number"
                      value={waitTime?.toString() ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v.trim() === '') setWaitTime(0);
                        else {
                          const n = Number(v);
                          if (!Number.isNaN(n) && n >= 0 && n <= 5000) setWaitTime(n);
                        }
                      }}
                      placeholder="0"
                      min="0"
                      max="5000"
                      className="mt-2 text-base h-11"
                    />
                    <p className="text-sm text-muted-foreground mt-1.5">
                      Additional delay before capturing the screenshot (0-5000 ms)
                    </p>
                  </div>
                </div>

                {/* Mobile preview switch */}
                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="mobile-preview"
                    checked={mobile}
                    onCheckedChange={(c) => toggleMobile(c === true)}
                    className="h-5 w-5 mt-[3px]"
                  />
                  <div>
                    <Label htmlFor="mobile-preview" className="text-base font-medium leading-none cursor-pointer">
                      Mobile preview
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1.5">Select mobile device </p>
                  </div>
                </div>

                {/* Device picker */}
                {mobile && (
                  <div className="ml-6 space-y-2">
                    <div className="flex gap-3 flex-wrap">
                      {devices.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => setDevice(d.value as 'iphone15' | 'galaxyS24')}
                          aria-pressed={device === d.value}
                          className={`px-3 py-1.5 rounded border text-sm font-medium transition-all
                            ${
                              device === d.value
                                ? 'bg-primary text-white border-primary shadow'
                                : 'bg-background border-border text-foreground hover:bg-muted'
                            }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom dimensions (only when not mobile) */}
                {!mobile && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-medium leading-none mb-3 block">Custom Dimensions</Label>
                      <p className="text-sm text-muted-foreground mb-3">Leave empty to use defaults (1920×1080)</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="width-input" className="text-sm font-medium">
                            Width (px)
                          </Label>
                          <Input
                            id="width-input"
                            type="number"
                            value={width?.toString() ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v.trim() === '') {
                                setWidth(null);
                              } else {
                                const n = Number(v);
                                if (!Number.isNaN(n) && n >= 0 && n <= 3840) {
                                  setWidth(n);
                                }
                              }
                            }}
                            placeholder="1920"
                            min="0"
                            max="3840"
                            className="mt-1 text-sm h-9"
                          />
                        </div>
                        <div>
                          <Label htmlFor="height-input" className="text-sm font-medium">
                            Height (px)
                          </Label>
                          <Input
                            id="height-input"
                            type="number"
                            value={height?.toString() ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v.trim() === '') {
                                setHeight(null);
                              } else {
                                const n = Number(v);
                                if (!Number.isNaN(n) && n >= 0 && n <= 2160) {
                                  setHeight(n);
                                }
                              }
                            }}
                            placeholder="1080"
                            min="0"
                            max="2160"
                            className="mt-1 text-sm h-9"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
}
