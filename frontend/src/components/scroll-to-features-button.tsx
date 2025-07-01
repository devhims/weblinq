'use client';

import { Button } from '@/components/ui/button';
import { scrollToSection } from '@/lib/scroll-utils';

export function ScrollToFeaturesButton() {
  const handleClick = () => {
    scrollToSection('features');
  };

  return (
    <Button size="lg" variant="ghost" className="h-10.5 rounded-xl px-5" onClick={handleClick}>
      <span className="text-nowrap">View API Features</span>
    </Button>
  );
}
