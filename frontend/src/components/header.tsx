'use client';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Menu, X } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';
import { AuthButtons } from '@/components/auth-buttons';
import { scrollToSection } from '@/lib/scroll-utils';

type MenuItem = {
  name: string;
  href: string;
  target?: string;
  action?: () => void;
};

const menuItems: MenuItem[] = [
  { name: 'Features', href: '#features', action: () => scrollToSection('features') },
  { name: 'Pricing', href: '#pricing', action: () => scrollToSection('pricing') },
  { name: 'API Docs', href: 'https://docs.weblinq.dev', target: '_blank' },
];

export const HeroHeader = () => {
  const [menuState, setMenuState] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header>
      <nav data-state={menuState && 'active'} className="fixed z-50 w-full px-2">
        {/* Light beam effect for nav - only visible when not scrolled */}
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 opacity-20 overflow-hidden transition-opacity duration-500',
            isScrolled && 'opacity-0',
          )}
        >
          <div className="w-[25rem] h-[50rem] absolute -left-10 -top-10 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,65%,.02)_50%,transparent_80%)]" />
          <div className="w-[15rem] h-[40rem] absolute left-20 -top-5 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,90%,.04)_0,hsla(0,0%,70%,.01)_70%,transparent_100%)]" />
        </div>

        <div
          className={cn(
            'mx-auto mt-2 max-w-6xl px-6 transition-all duration-500 lg:px-12 relative',
            isScrolled
              ? 'bg-background/80 max-w-4xl rounded-2xl border backdrop-blur-xl shadow-lg shadow-black/5 lg:px-5'
              : 'backdrop-blur-md',
          )}
        >
          {/* Subtle gradient overlay for unscrolled state */}
          {!isScrolled && (
            <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-background/40 to-background/60 rounded-2xl" />
          )}

          <div className="relative flex flex-wrap items-center justify-between gap-6 py-3 lg:gap-0 lg:py-4">
            <div className="flex w-full justify-between lg:w-auto">
              <Link href="/" aria-label="home" className="flex items-center space-x-2 relative z-10">
                <Logo />
              </Link>

              <button
                onClick={() => setMenuState(!menuState)}
                aria-label={menuState == true ? 'Close Menu' : 'Open Menu'}
                className={cn(
                  'relative z-20 -m-2.5 -mr-4 block cursor-pointer p-2.5 lg:hidden transition-all duration-300 rounded-lg',
                  isScrolled ? 'hover:bg-muted/50' : 'hover:bg-background/30 backdrop-blur-sm',
                )}
              >
                <Menu className="in-data-[state=active]:rotate-180 in-data-[state=active]:scale-0 in-data-[state=active]:opacity-0 m-auto size-6 duration-200" />
                <X className="in-data-[state=active]:rotate-0 in-data-[state=active]:scale-100 in-data-[state=active]:opacity-100 absolute inset-0 m-auto size-6 -rotate-180 scale-0 opacity-0 duration-200" />
              </button>
            </div>

            <div className="absolute inset-0 m-auto hidden size-fit lg:block">
              <ul className="flex gap-8 text-sm">
                {menuItems.map((item, index) => (
                  <li key={index}>
                    {item.action ? (
                      <button
                        onClick={item.action}
                        className={cn(
                          'relative group block duration-300 px-3 py-2 rounded-lg transition-all',
                          'text-muted-foreground hover:text-foreground',
                          'hover:bg-background/20 backdrop-blur-sm',
                        )}
                      >
                        <span className="relative z-10">{item.name}</span>
                        {/* Hover glow effect */}
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </button>
                    ) : (
                      <Link
                        href={item.href}
                        className={cn(
                          'relative group block duration-300 px-3 py-2 rounded-lg transition-all',
                          'text-muted-foreground hover:text-foreground',
                          'hover:bg-background/20 backdrop-blur-sm',
                        )}
                        target={item.target}
                      >
                        <span className="relative z-10">{item.name}</span>
                        {/* Hover glow effect */}
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-background in-data-[state=active]:block lg:in-data-[state=active]:flex mb-6 hidden w-full flex-wrap items-center justify-end space-y-8 rounded-3xl border p-6 shadow-2xl shadow-zinc-300/20 md:flex-nowrap lg:m-0 lg:flex lg:w-fit lg:gap-6 lg:space-y-0 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none dark:shadow-none dark:lg:bg-transparent">
              <div className="lg:hidden">
                <ul className="space-y-6 text-base">
                  {menuItems.map((item, index) => (
                    <li key={index}>
                      {item.action ? (
                        <button
                          onClick={() => {
                            item.action?.();
                            setMenuState(false); // Close mobile menu after clicking
                          }}
                          className="text-muted-foreground hover:text-foreground block duration-150 w-full text-left"
                        >
                          <span>{item.name}</span>
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          className="text-muted-foreground hover:text-foreground block duration-150"
                        >
                          <span>{item.name}</span>
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex w-full flex-col space-y-3 sm:flex-row sm:gap-3 sm:space-y-0 md:w-fit relative z-10">
                <AuthButtons />
                {/* <Button
                  asChild
                  size='sm'
                  className={cn(
                    'shadow-lg transition-all duration-300',
                    isScrolled
                      ? 'lg:inline-flex shadow-primary/20 hover:shadow-primary/30'
                      : 'hidden'
                  )}
                >
                  <Link href='/dashboard/studio'>
                    <span>Try Studio</span>
                  </Link>
                </Button> */}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};
