import type { Metadata } from 'next';

import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { Outfit } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';

import { Geist, Geist_Mono } from 'next/font/google';
import { QueryProvider } from '@/providers/query-provider';
import './globals.css';

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
});

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'WebLinq',
  description:
    'Extract data, capture screenshots, and search the internet with our web scraping and browser automation API.',
  metadataBase: new URL('https://weblinq.dev'),
  openGraph: {
    type: 'website',
    title: 'WebLinq',
    description:
      'Extract data, capture screenshots, and search the internet with our web scraping and browser automation API.',
    locale: 'en_US',
    siteName: 'WebLinq',
    url: 'https://weblinq.dev',
  },
  icons: {
    icon: '/favicon.ico',
  },
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${outfit.variable} ${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NuqsAdapter>
          <QueryProvider>{children}</QueryProvider>
        </NuqsAdapter>
        <Toaster />
      </body>
    </html>
  );
}
