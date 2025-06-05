import { cn } from '../lib/utils';
import Image from 'next/image';

export const Logo = ({
  className,
  uniColor,
}: {
  className?: string;
  uniColor?: boolean;
}) => {
  return (
    <Image
      src='/logo.png'
      alt='Logo'
      width={100}
      height={32}
      className={cn('h-7 w-auto', className)}
      style={{
        filter: uniColor ? 'brightness(0) saturate(100%)' : undefined,
      }}
    />
  );
};
