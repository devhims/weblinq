import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';

export function JsonActions() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [jsonPrompt, setJsonPrompt] = useState(
    searchParams.get('jsonPrompt') ||
      'Get me the list of main sections on this webpage.'
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
    updateSearchParams({ jsonPrompt });
  }, [jsonPrompt]);

  return (
    <div className='space-y-4 mb-4'>
      <div>
        <Label htmlFor='jsonPrompt' className='text-lg font-medium'>
          Custom Prompt
        </Label>
        <Textarea
          id='jsonPrompt'
          value={jsonPrompt}
          onChange={(e) => setJsonPrompt(e.target.value)}
          placeholder='E.g., "Get me the list of AI products" or "Extract the main menu items"'
          className='h-24 text-base p-3'
        />
        <p className='text-sm text-muted-foreground mt-1.5'>
          Examples: "Get me all blog post titles", "Extract all images on the
          page", "List the main navigation links"
        </p>
      </div>
    </div>
  );
}

export default JsonActions;
