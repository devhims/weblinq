import { cn } from '../lib/utils';
import Image from 'next/image';

export const Logo = ({ className, uniColor }: { className?: string; uniColor?: boolean }) => {
  return (
    <Image
      src="/logo.png"
      alt="Logo"
      width={128}
      height={128}
      className={cn('h-10 w-auto', className)}
      style={{
        filter: uniColor ? 'brightness(0) saturate(100%)' : undefined,
      }}
    />
  );
};
