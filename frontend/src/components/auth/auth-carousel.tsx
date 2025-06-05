'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Code,
  Camera,
  FileJson,
  Search,
  Link as LinkIcon,
  FileImage,
  Zap,
  Shield,
  TrendingUp,
  ChevronDown,
  Type,
  Settings,
} from 'lucide-react';

const carouselSlides = [
  {
    id: 1,
    title: 'Web Scraping',
    subtitle: 'Extract content with CSS selectors, markdown, HTML & links',
    content: (
      <div className='space-y-2.5'>
        <div className='text-xs text-muted-foreground'>
          Extract data with CSS selectors, multiple formats, and smart
          filtering.
        </div>

        {/* Simplified results example */}
        <div className='border rounded-md overflow-hidden'>
          <div className='flex border-b bg-card text-xs'>
            <div className='px-2 py-1.5 font-medium border-b-2 border-primary text-primary bg-background'>
              Elements
            </div>
            <div className='px-2 py-1.5 text-muted-foreground'>Markdown</div>
            <div className='px-2 py-1.5 text-muted-foreground'>Links</div>
          </div>
          <div className='p-2 bg-background'>
            <div className='bg-muted/30 rounded border'>
              <div className='bg-muted p-1.5 flex items-center text-xs'>
                <ChevronDown className='h-3 w-3 mr-1' />
                <code className='bg-accent px-1 py-0.5 rounded'>h1.title</code>
                <span className='ml-1 text-muted-foreground'>(3)</span>
              </div>
              <div className='p-1.5 bg-background'>
                <div className='bg-accent/30 p-1.5 rounded border mb-1'>
                  <div className='flex items-center mb-0.5'>
                    <Type className='h-3 w-3 text-primary mr-1' />
                    <span className='text-xs font-medium'>Text Content</span>
                  </div>
                  <p className='text-xs'>
                    &quot;Welcome to Modern Web Development&quot;
                  </p>
                </div>
                <div className='flex gap-1 text-xs'>
                  <div className='bg-accent/20 px-1 py-0.5 rounded'>640×32</div>
                  <div className='bg-accent/30 px-1 py-0.5 rounded'>24,120</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Compact preset selectors */}
        <div className='grid grid-cols-3 gap-1.5'>
          {[
            { label: 'Headings', selector: 'h1, h2, h3', icon: Type },
            { label: 'Links', selector: 'a', icon: LinkIcon },
            { label: 'Images', selector: 'img', icon: FileImage },
          ].map((preset) => (
            <div
              key={preset.label}
              className='flex items-center space-x-1.5 p-1.5 rounded bg-muted/20 border'
            >
              <preset.icon className='h-3 w-3 text-blue-500' />
              <div>
                <div className='font-medium text-xs'>{preset.label}</div>
                <code className='text-xs text-muted-foreground'>
                  {preset.selector}
                </code>
              </div>
            </div>
          ))}
        </div>

        {/* Compact advanced options */}
        <div className='bg-muted/20 rounded p-2 border'>
          <div className='flex items-center mb-1.5'>
            <Settings className='h-3 w-3 mr-1.5' />
            <span className='text-xs font-medium'>Advanced Options</span>
            <Badge variant='outline' className='ml-1.5 text-xs px-1.5 py-0'>
              3 active
            </Badge>
          </div>
          <div className='grid grid-cols-3 gap-1 text-xs'>
            <div className='flex items-center space-x-1.5'>
              <div className='h-2 w-2 bg-green-500 rounded-sm'></div>
              <span>Main Content</span>
            </div>
            <div className='flex items-center space-x-1.5'>
              <div className='h-2 w-2 bg-blue-500 rounded-sm'></div>
              <span>Markdown</span>
            </div>
            <div className='flex items-center space-x-1.5'>
              <div className='h-2 w-2 bg-purple-500 rounded-sm'></div>
              <span>Links</span>
            </div>
          </div>
        </div>

        <div className='text-center text-xs text-muted-foreground'>
          Multiple formats • Smart filtering • Combined results
        </div>
      </div>
    ),
    icon: <Code className='h-6 w-6' />,
  },
  {
    id: 2,
    title: 'Visual Capture',
    subtitle: 'Screenshots and PDF generation',
    content: (
      <div className='space-y-2.5'>
        <div className='text-xs text-muted-foreground'>
          Generate high-quality visual captures with customizable dimensions and
          formats.
        </div>

        {/* Compact screenshot result */}
        <div className='border rounded-lg overflow-hidden'>
          <div className='bg-muted/60 p-1.5 text-center border-b'>
            <div className='text-xs font-medium'>Screenshot Result</div>
            <div className='text-xs text-muted-foreground'>
              imageUrl: "https://api.browzy.com/screenshots/abc123.png"
            </div>
          </div>
          <div className='p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-center'>
            <Camera className='h-8 w-8 mx-auto mb-1.5 text-blue-500' />
            <div className='text-xs font-medium'>1920×1080 Screenshot</div>
            <div className='text-xs text-muted-foreground'>
              Full page capture
            </div>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-2'>
          <div className='flex items-center justify-between p-2 rounded-lg border bg-card'>
            <div className='flex items-center space-x-1.5'>
              <FileImage className='h-4 w-4 text-red-500' />
              <span className='text-xs font-medium'>PDF</span>
            </div>
            <Badge variant='secondary' className='text-xs px-1.5 py-0'>
              A4
            </Badge>
          </div>

          <div className='flex items-center justify-between p-2 rounded-lg border bg-card'>
            <div className='flex items-center space-x-1.5'>
              <Camera className='h-4 w-4 text-blue-500' />
              <span className='text-xs font-medium'>PNG</span>
            </div>
            <Badge variant='secondary' className='text-xs px-1.5 py-0'>
              High-res
            </Badge>
          </div>
        </div>

        {/* Performance indicators */}
        <div className='bg-muted/20 rounded p-2 border'>
          <div className='grid grid-cols-3 gap-2 text-center text-xs'>
            <div>
              <div className='font-bold text-blue-500'>2.3s</div>
              <div className='text-muted-foreground'>Speed</div>
            </div>
            <div>
              <div className='font-bold text-green-500'>4K</div>
              <div className='text-muted-foreground'>Max Res</div>
            </div>
            <div>
              <div className='font-bold text-purple-500'>Both</div>
              <div className='text-muted-foreground'>Viewports</div>
            </div>
          </div>
        </div>

        <div className='text-center text-xs text-muted-foreground'>
          Mobile & Desktop viewports • Custom dimensions • Multiple formats
        </div>
      </div>
    ),
    icon: <Camera className='h-6 w-6' />,
  },
  {
    id: 3,
    title: 'Structured Data',
    subtitle: 'JSON extraction with AI',
    content: (
      <div className='space-y-2.5'>
        <div className='text-xs text-muted-foreground'>
          Transform web content into structured JSON using intelligent
          extraction patterns.
        </div>

        {/* Compact JSON result */}
        <div className='bg-muted/30 rounded-lg p-2 font-mono text-xs border'>
          <div className='text-muted-foreground mb-1.5 text-xs'>
            // API Response
          </div>
          <div className='space-y-0.5 text-xs'>
            <div>{'{'}</div>
            <div className='ml-2'>
              <span className='text-blue-400'>"title"</span>:{' '}
              <span className='text-green-400'>"MacBook Pro 16-inch"</span>,
            </div>
            <div className='ml-2'>
              <span className='text-blue-400'>"price"</span>:{' '}
              <span className='text-yellow-400'>2499.00</span>,
            </div>
            <div className='ml-2'>
              <span className='text-blue-400'>"currency"</span>:{' '}
              <span className='text-green-400'>"USD"</span>,
            </div>
            <div className='ml-2'>
              <span className='text-blue-400'>"availability"</span>:{' '}
              <span className='text-purple-400'>true</span>,
            </div>
            <div className='ml-2'>
              <span className='text-blue-400'>"specs"</span>: [
              <span className='text-green-400'>"M3 Pro"</span>,{' '}
              <span className='text-green-400'>"36GB RAM"</span>]
            </div>
            <div>{'}'}</div>
          </div>
        </div>

        <div className='grid grid-cols-3 gap-2 text-center'>
          <div className='bg-muted/20 rounded p-2 border'>
            <div className='text-sm font-bold text-blue-500'>15ms</div>
            <div className='text-xs text-muted-foreground'>Processing</div>
          </div>
          <div className='bg-muted/20 rounded p-2 border'>
            <div className='text-sm font-bold text-green-500'>99.8%</div>
            <div className='text-xs text-muted-foreground'>Accuracy</div>
          </div>
          <div className='bg-muted/20 rounded p-2 border'>
            <div className='text-sm font-bold text-purple-500'>50+</div>
            <div className='text-xs text-muted-foreground'>Fields</div>
          </div>
        </div>

        {/* Use cases */}
        <div className='bg-muted/20 rounded p-2 border'>
          <div className='text-xs font-medium mb-1.5'>Perfect for:</div>
          <div className='grid grid-cols-3 gap-1 text-xs text-center text-muted-foreground'>
            <span>E-commerce</span>
            <span>Real estate</span>
            <span>Data analysis</span>
          </div>
        </div>

        <div className='text-center text-xs text-muted-foreground'>
          AI-powered extraction • Custom schemas • High accuracy
        </div>
      </div>
    ),
    icon: <FileJson className='h-6 w-6' />,
  },
  {
    id: 4,
    title: 'Web Search',
    subtitle: 'Search with metadata extraction',
    content: (
      <div className='space-y-2.5'>
        <div className='text-xs text-muted-foreground'>
          Multi-engine search with deduplication and ranking.
        </div>

        {/* Compact API Response */}
        <div className='bg-muted/30 rounded-lg p-2 font-mono text-xs border'>
          <div className='text-muted-foreground mb-1.5'>// API Response</div>
          <div className='space-y-0.5'>
            <div>{'{'}</div>
            <div className='ml-2'>
              <span className='text-blue-400'>"results"</span>: [
              <span className='text-muted-foreground'>/* array */</span>],
            </div>
            <div className='ml-2'>
              <span className='text-blue-400'>"totalResults"</span>:{' '}
              <span className='text-yellow-400'>15</span>,
            </div>
            <div className='ml-2'>
              <span className='text-blue-400'>"searchTime"</span>:{' '}
              <span className='text-yellow-400'>347</span>,
            </div>
            <div className='ml-2'>
              <span className='text-blue-400'>"sources"</span>: [
              <span className='text-green-400'>"startpage"</span>,{' '}
              <span className='text-green-400'>"bing"</span>]
            </div>
            <div>{'}'}</div>
          </div>
        </div>

        {/* Search Engine Sources */}
        <div className='grid grid-cols-3 gap-1.5'>
          {[
            { name: 'Startpage', status: 'Active', color: 'bg-green-500' },
            { name: 'Bing', status: 'Active', color: 'bg-blue-500' },
            { name: 'DuckDuckGo', status: 'Limited', color: 'bg-yellow-500' },
          ].map((engine) => (
            <div
              key={engine.name}
              className='flex items-center space-x-1.5 p-1.5 rounded border bg-card'
            >
              <div className={`h-2 w-2 rounded-full ${engine.color}`}></div>
              <div>
                <div className='font-medium text-xs'>{engine.name}</div>
                <div className='text-xs text-muted-foreground'>
                  {engine.status}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Performance Metrics */}
        <div className='bg-muted/20 rounded p-2 border'>
          <div className='flex items-center justify-between text-xs'>
            <div className='flex items-center space-x-1.5'>
              <Search className='h-3 w-3 text-blue-500' />
              <span className='font-medium'>Performance</span>
            </div>
            <div className='flex space-x-2'>
              <span className='font-semibold text-green-600'>347ms</span>
              <span className='font-semibold text-blue-600'>99.2%</span>
              <span className='font-semibold text-purple-600'>3 engines</span>
            </div>
          </div>
        </div>

        <div className='text-center text-xs text-muted-foreground'>
          Deduplication • Relevance ranking • Multi-source aggregation
        </div>
      </div>
    ),
    icon: <Search className='h-6 w-6' />,
  },
];

export default function AuthCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide(
      (prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length
    );
  };

  const currentSlideData = carouselSlides[currentSlide];

  return (
    <div className='h-full w-full flex flex-col'>
      {/* Header */}
      {/* <div className='mb-8'>
        <h2 className='text-3xl font-bold mb-2'>Linking LLMs to the web</h2>
        <p className='text-muted-foreground'>
          Professional web scraping and data extraction platform.
        </p>
      </div> */}

      {/* Main carousel card */}
      <Card className='flex-1 relative overflow-hidden'>
        <CardHeader className='pb-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-2'>
              {currentSlideData.icon}
              <CardTitle className='text-xl'>
                {currentSlideData.title}
              </CardTitle>
            </div>
            <div className='flex space-x-1'>
              {carouselSlides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index === currentSlide
                      ? 'bg-primary'
                      : 'bg-muted hover:bg-muted-foreground/50'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className='text-sm text-muted-foreground'>
            {currentSlideData.subtitle}
          </p>
        </CardHeader>
        <CardContent className='pb-6 h-[360px]'>
          {currentSlideData.content}
        </CardContent>

        {/* Navigation buttons */}
        <Button
          variant='ghost'
          size='icon'
          className='absolute left-4 top-1/2 -translate-y-1/2 h-8 w-8 opacity-60 hover:opacity-100'
          onClick={prevSlide}
        >
          <ChevronLeft className='h-4 w-4' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 opacity-60 hover:opacity-100'
          onClick={nextSlide}
        >
          <ChevronRight className='h-4 w-4' />
        </Button>
      </Card>

      {/* Bottom features */}
      <div className='mt-6 text-center'>
        <p className='text-sm text-muted-foreground mb-3'>
          Trusted by developers worldwide
        </p>
        <div className='flex justify-center space-x-6 text-xs text-muted-foreground'>
          <div className='flex items-center space-x-1'>
            <Zap className='h-3 w-3' />
            <span>Fast</span>
          </div>
          <div className='flex items-center space-x-1'>
            <Shield className='h-3 w-3' />
            <span>Reliable</span>
          </div>
          <div className='flex items-center space-x-1'>
            <TrendingUp className='h-3 w-3' />
            <span>Scalable</span>
          </div>
        </div>
      </div>
    </div>
  );
}
