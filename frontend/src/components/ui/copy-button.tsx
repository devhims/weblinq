'use client';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';
import { CheckIcon, ClipboardIcon } from 'lucide-react';

interface CopyButtonProps {
  content: any;
  /** true = use darker icon/bg intended for dark card backgrounds */
  darkBackground?: boolean;
  /** if true the button is rendered inline (no absolute positioning) */
  inline?: boolean;
  /** optional extra classname overrides */
  className?: string;
}

/**
 * Generic copy-to-clipboard button used across Studio result components.
 *
 * Handles `copied` state, tooltip, and some minor style variants.
 */
export function CopyButton({ content, darkBackground = false, inline = false, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = typeof content === 'string' ? content : JSON.stringify(content, null, 2);

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const baseClasses = inline ? '' : 'absolute top-3 right-6 z-10 h-8 w-8 p-0';

  const colorClasses = darkBackground
    ? 'text-muted hover:text-foreground hover:bg-accent/60'
    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`${baseClasses} ${colorClasses} ${className}`.trim()}
            onClick={handleCopy}
          >
            {copied ? <CheckIcon className="h-4 w-4 text-primary" /> : <ClipboardIcon className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{copied ? 'Copied!' : 'Copy to clipboard'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
