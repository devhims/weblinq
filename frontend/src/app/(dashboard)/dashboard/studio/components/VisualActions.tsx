import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

export function ScreenshotActions() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  // Initialize state from URL parameters or defaults
  const [format, setFormat] = useState(searchParams.get('format') || 'png');
  const [fullPage, setFullPage] = useState(
    searchParams.get('fullPage') !== 'false'
  );
  const [quality, setQuality] = useState(
    searchParams.get('quality')
      ? parseInt(searchParams.get('quality') as string)
      : 80
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

  useEffect(() => {
    const updates: Record<string, any> = {
      format,
      fullPage,
    };
    if (format !== 'png') {
      updates.quality = quality;
    }
    updateSearchParams(updates);
  }, [format, fullPage, quality]);

  const formats = [
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WEBP' },
  ];
  const captureModes = [
    { value: 'fullpage', label: 'Full Page' },
    { value: 'viewport', label: 'Viewport Only' },
  ];
  const safeCaptureMode = fullPage ? 'fullpage' : 'viewport';

  return (
    <div className='flex flex-col gap-6 mb-4 p-4 border rounded-lg bg-muted/30'>
      <div>
        <Label className='text-base font-semibold mb-1 block'>
          Image Format
        </Label>
        <div className='flex flex-row gap-3 mt-2'>
          {formats.map((f) => (
            <button
              key={f.value}
              type='button'
              onClick={() => setFormat(f.value)}
              className={`px-4 py-2 rounded border text-base font-medium transition-all
                ${format === f.value ? 'bg-primary text-white border-primary shadow' : 'bg-background border-border text-foreground hover:bg-muted'}
              `}
              aria-pressed={format === f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
        {(format === 'jpeg' || format === 'webp') && (
          <div className='mt-4 max-w-xs'>
            <Label
              htmlFor='quality'
              className='text-base font-medium mb-1 block'
            >
              Image Quality
            </Label>
            <div className='relative w-full mt-2 mb-6'>
              <Slider
                id='quality'
                min={1}
                max={100}
                step={1}
                value={[quality]}
                onValueChange={(val) => setQuality(val[0])}
              />
            </div>
            <div className='flex justify-between text-sm mt-1'>
              <span>1</span>
              <span className='text-center'>Current: {quality}</span>
              <span>100</span>
            </div>
          </div>
        )}
      </div>
      <div className='max-w-xs'>
        <Label className='text-base font-semibold mb-1 block'>
          Capture Mode
        </Label>
        <div className='flex flex-row gap-3 mt-2'>
          {captureModes.map((mode) => (
            <button
              key={mode.value}
              type='button'
              onClick={() => setFullPage(mode.value === 'fullpage')}
              className={`px-4 py-2 rounded border text-base font-medium transition-all
                ${safeCaptureMode === mode.value ? 'bg-primary text-white border-primary shadow' : 'bg-background border-border text-foreground hover:bg-muted'}
              `}
              aria-pressed={safeCaptureMode === mode.value}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScreenshotActions;
