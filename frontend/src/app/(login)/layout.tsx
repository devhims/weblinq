import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import AuthCarousel from '@/components/auth/auth-carousel';
import Link from 'next/link';

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <section className='flex min-h-screen bg-white py-16 md:py-0 dark:bg-zinc-900'>
      {/* Back button - only show on mobile */}
      <Button
        className='fixed top-5 left-5 z-10 md:hidden'
        variant={'outline'}
        asChild
      >
        <Link href={'/'}>
          <Icons.arrowLeft className='h-4 w-4 mr-1' />
          Back
        </Link>
      </Button>

      {/* Desktop split layout */}
      <div className='hidden md:flex w-full min-h-screen'>
        {/* Left side - Auth form */}
        <div className='w-1/2 flex items-center justify-center p-8 lg:p-16'>
          <div className='w-full max-w-md'>{children}</div>
        </div>

        {/* Right side - Carousel */}
        <div className='w-1/2 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-700 flex items-center justify-center p-8 lg:p-16'>
          <div className='w-full max-w-lg'>
            <AuthCarousel />
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className='md:hidden flex flex-col items-center justify-center w-full'>
        {children}
      </div>
    </section>
  );
}
