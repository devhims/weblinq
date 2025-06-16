'use client';

import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useQueryState, parseAsInteger, parseAsBoolean, parseAsStringEnum } from 'nuqs';
import { useState } from 'react';

const deviceParser = parseAsStringEnum(['iphone15', 'galaxyS24']).withDefault('iphone15');

export function ScreenshotActions() {
  /* ───── URL-backed state ───────────────────────────── */
  const [format, setFormat] = useQueryState('format', { defaultValue: 'png' });
  const [quality, setQuality] = useQueryState('quality', parseAsInteger.withDefault(80));
  const [fullPage, setFullPage] = useQueryState('fullPage', parseAsBoolean.withDefault(false));
  const [mobile, setMobile] = useQueryState('mobile', parseAsBoolean.withDefault(false));
  const [device, setDevice] = useQueryState('device', deviceParser);

  /* ───── local UI state (accordion) ─────────────────── */
  const [showAdvanced, setShowAdvanced] = useState(false);

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
          {(['viewport', 'fullpage'] as const).map((r) => (
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
      <section className="max-w-xs">
        <button
          type="button"
          onClick={() => setShowAdvanced((o) => !o)}
          className="text-base font-semibold underline underline-offset-2"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced options
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            {/* — Mobile preview switch — */}
            <div className="flex items-center gap-3">
              <input id="mobile" type="checkbox" checked={mobile} onChange={(e) => toggleMobile(e.target.checked)} />
              <Label htmlFor="mobile">Mobile preview</Label>
            </div>

            {/* — Device picker (only when mobile) — */}
            {mobile && (
              <>
                <Label className="text-sm font-medium block">Device</Label>
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
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
