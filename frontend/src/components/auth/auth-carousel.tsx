'use client';

import React, { useState, useEffect } from 'react';
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
  FileText,
} from 'lucide-react';

const carouselSlides = [
  {
    id: 1,
    title: 'Web Scraping',
    subtitle: 'CSS selectors, Markdown & JSON',
    content: (
      <div className='space-y-4'>
        <div className='text-sm text-muted-foreground'>
          Extract data with CSS selectors, multiple formats, and smart
          filtering.
        </div>

        {/* Enhanced results example */}
        <div className='border border-border/50 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm'>
          <div className='flex border-b bg-muted/50'>
            <div className='px-4 py-3 font-medium text-sm border-b-2 border-primary text-primary bg-card/80'>
              Selectors
            </div>
            <div className='px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors'>
              Markdown
            </div>
            <div className='px-4 py-3 text-sm text-muted-foreground hover:text-foreground transition-colors'>
              JSON
            </div>
          </div>
          <div className='p-4'>
            <div className='bg-muted/50 rounded-lg border border-border/50'>
              <div className='p-3 flex items-center justify-between border-b border-border/50'>
                <div className='flex items-center'>
                  <ChevronDown className='h-4 w-4 mr-2 text-muted-foreground' />
                  <code className='text-sm font-mono bg-primary/10 text-primary px-2 py-1 rounded'>
                    h1.title
                  </code>
                  <span className='ml-2 text-sm text-muted-foreground'>
                    (3)
                  </span>
                </div>
              </div>
              <div className='p-3'>
                <div className='bg-card p-3 rounded-lg border border-border/50'>
                  <div className='flex items-center mb-2'>
                    <Type className='h-4 w-4 text-primary mr-2' />
                    <span className='text-sm font-medium text-foreground'>
                      Text Content
                    </span>
                  </div>
                  <p className='text-sm text-muted-foreground font-mono'>
                    &quot;Welcome to Modern Web Development&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced preset selectors */}
        <div className='grid grid-cols-3 gap-3'>
          {[
            {
              label: 'Selectors',
              icon: Code,
            },
            {
              label: 'Markdown',
              icon: FileText,
            },
            {
              label: 'JSON',
              icon: FileJson,
            },
          ].map((preset) => (
            <div
              key={preset.label}
              className='flex flex-col items-center space-y-2 p-3 rounded-xl bg-card/70 border border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5'
            >
              <div className='p-2 bg-primary/10 rounded-lg border border-primary/20'>
                <preset.icon className='h-4 w-4 text-primary' />
              </div>
              <div className='text-center'>
                <div className='font-medium text-xs text-foreground'>
                  {preset.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    icon: <Code className='h-6 w-6' />,
    badge: 'Advanced',
  },
  {
    id: 2,
    title: 'Visual Capture',
    subtitle: 'Screenshots & PDF',
    content: (
      <div className='space-y-4'>
        <div className='text-sm text-muted-foreground'>
          Generate high-quality visual captures with customizable dimensions and
          formats.
        </div>

        {/* Enhanced screenshot result */}
        <div className='border border-border/50 rounded-xl overflow-hidden bg-card/50 backdrop-blur-sm'>
          <div className='bg-muted/50 p-3 text-center border-b border-border/50'>
            <div className='flex items-center justify-center gap-2 mb-2'>
              <div className='w-2 h-2 bg-primary rounded-full animate-pulse'></div>
              <span className='text-sm font-medium text-foreground'>
                Screenshot Result
              </span>
              <Badge variant='outline' className='text-xs'>
                ~150ms
              </Badge>
            </div>
            <div className='text-xs text-muted-foreground font-mono'>
              imageUrl:
              &quot;https://api.weblinq.dev/screenshots/abc123.png&quot;
            </div>
          </div>
          <div className='p-6 text-center bg-gradient-to-br from-card to-primary/5'>
            <div className='p-4 bg-primary rounded-2xl inline-block mb-4 shadow-lg'>
              <Camera className='h-10 w-10 text-primary-foreground' />
            </div>
            <div className='text-lg font-bold text-foreground'>
              1920×1080 Screenshot
            </div>
            <div className='text-sm text-muted-foreground'>
              Full page capture
            </div>
          </div>
        </div>

        {/* Enhanced format options */}
        <div className='grid grid-cols-2 gap-4'>
          <div className='flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/70 hover:shadow-lg transition-all duration-300'>
            <div className='flex items-center space-x-3'>
              <div className='p-2 bg-primary/10 rounded-lg'>
                <FileText className='h-5 w-5 text-primary' />
              </div>
              <span className='text-sm font-medium text-foreground'>PDF</span>
            </div>
            <Badge
              variant='secondary'
              className='bg-primary/10 text-primary dark:bg-primary/20'
            >
              A4
            </Badge>
          </div>

          <div className='flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/70 hover:shadow-lg transition-all duration-300'>
            <div className='flex items-center space-x-3'>
              <div className='p-2 bg-primary/10 rounded-lg'>
                <Camera className='h-5 w-5 text-primary' />
              </div>
              <span className='text-sm font-medium text-foreground'>PNG</span>
            </div>
            <Badge
              variant='secondary'
              className='bg-primary/10 text-primary dark:bg-primary/20'
            >
              High-res
            </Badge>
          </div>
        </div>
      </div>
    ),
    icon: <Camera className='h-6 w-6' />,
    badge: '4K Ready',
  },
  {
    id: 3,
    title: 'Structured Data',
    subtitle: 'AI-powered extraction',
    content: (
      <div className='space-y-4'>
        <div className='text-sm text-muted-foreground'>
          Transform web content into structured JSON using intelligent
          extraction patterns.
        </div>

        {/* Enhanced JSON result */}
        <div className='bg-gradient-to-br from-gray-900 to-black rounded-xl p-4 font-mono text-sm border border-gray-800 shadow-2xl'>
          <div className='flex items-center justify-between mb-3'>
            <div className='flex items-center'>
              <span className='w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse'></span>
              <span className='text-xs'>{`// Live API Response`}</span>
            </div>
            <Badge variant='outline' className='text-xs'>
              15ms avg
            </Badge>
          </div>
          <div className='space-y-1 text-sm'>
            <div className='text-gray-300'>{'{'}</div>
            <div className='ml-4'>
              <span className='text-blue-400'>&quot;title&quot;</span>:
              <span className='text-yellow-400'>
                {' '}
                &quot;MacBook Pro 16-inch&quot;
              </span>
              ,
            </div>
            <div className='ml-4'>
              <span className='text-blue-400'>&quot;price&quot;</span>:
              <span className='text-yellow-400'> 2499.00</span>,
            </div>
            <div className='ml-4'>
              <span className='text-blue-400'>&quot;currency&quot;</span>:
              <span className='text-yellow-400'> &quot;USD&quot;</span>,
            </div>
            <div className='ml-4'>
              <span className='text-blue-400'>&quot;availability&quot;</span>:
              <span className='text-yellow-400'> true</span>
            </div>
            <div className='text-gray-300'>{'}'}</div>
          </div>
        </div>

        {/* Enhanced metrics */}
        <div className='grid grid-cols-3 gap-4 text-center'>
          <div className='p-4 bg-card/70 rounded-xl border border-border/50'>
            <div className='text-2xl font-bold text-primary mb-1'>15ms</div>
            <div className='text-xs text-muted-foreground'>Processing</div>
          </div>
          <div className='p-4 bg-card/70 rounded-xl border border-border/50'>
            <div className='text-2xl font-bold text-primary mb-1'>99.8%</div>
            <div className='text-xs text-muted-foreground'>Accuracy</div>
          </div>
          <div className='p-4 bg-card/70 rounded-xl border border-border/50'>
            <div className='text-2xl font-bold text-primary mb-1'>50+</div>
            <div className='text-xs text-muted-foreground'>Fields</div>
          </div>
        </div>
      </div>
    ),
    icon: <FileJson className='h-6 w-6' />,
    badge: '99.8%',
  },
  {
    id: 4,
    title: 'Web Search',
    subtitle: 'Multi-engine aggregation',
    content: (
      <div className='space-y-4'>
        <div className='text-sm text-muted-foreground'>
          Multi-engine search with deduplication and ranking.
        </div>

        {/* Enhanced API Response */}
        <div className='bg-gradient-to-br from-gray-900 to-black rounded-xl p-4 font-mono text-sm border border-gray-800 shadow-2xl'>
          <div className='flex items-center mb-3'>
            <span className='w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse'></span>
            <span className='text-xs'>{`// Multi-engine Search`}</span>
          </div>
          <div className='space-y-0.5 text-sm'>
            <div className='text-gray-300'>{'{'}</div>
            <div className='ml-3'>
              <span className='text-blue-400'>&quot;results&quot;</span>: [
              <span className='text-gray-500'>{`/* 15 items */`}</span>],
            </div>
            <div className='ml-3'>
              <span className='text-blue-400'>&quot;totalResults&quot;</span>:
              <span className='text-yellow-400'> 15</span>,
            </div>
            <div className='ml-3'>
              <span className='text-blue-400'>&quot;searchTime&quot;</span>:
              <span className='text-yellow-400'> 347</span>,
            </div>
            <div className='text-gray-300'>{'}'}</div>
          </div>
        </div>

        {/* Enhanced engine status */}
        <div className='space-y-3'>
          <div className='text-sm font-medium text-foreground mb-3'>
            Engine Status
          </div>
          {[
            {
              name: 'Startpage',
              status: 'Active',
              uptime: '99.9%',
              color: 'bg-green-500',
            },
            {
              name: 'Bing',
              status: 'Active',
              uptime: '99.7%',
              color: 'bg-primary',
            },
          ].map((engine) => (
            <div
              key={engine.name}
              className='flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card/70 hover:shadow-lg transition-all duration-300'
            >
              <div className='flex items-center space-x-3'>
                <div className={`h-3 w-3 rounded-full ${engine.color}`} />
                <div>
                  <div className='font-medium text-sm text-foreground'>
                    {engine.name}
                  </div>
                  <div className='text-xs text-muted-foreground'>
                    {engine.status}
                  </div>
                </div>
              </div>
              <div className='text-right'>
                <div className='text-sm font-bold text-foreground'>
                  {engine.uptime}
                </div>
                <div className='text-xs text-muted-foreground'>Uptime</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    icon: <Search className='h-6 w-6' />,
    badge: 'Global',
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
      <div className='group relative bg-muted/50 backdrop-blur-sm rounded-3xl border border-border/50 p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 flex-1 overflow-hidden'>
        <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/3 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

        <div className='flex items-start justify-between mb-6 relative'>
          <div className='flex items-center space-x-4'>
            <div className='p-3 bg-primary rounded-xl shadow-lg'>
              {React.cloneElement(currentSlideData.icon, {
                className: 'h-6 w-6 text-primary-foreground',
              })}
            </div>
            <div>
              <h3 className='text-2xl font-bold text-foreground mb-1'>
                {currentSlideData.title}
              </h3>
              <p className='text-sm text-muted-foreground'>
                {currentSlideData.subtitle}
              </p>
            </div>
          </div>
          <div className='flex items-center space-x-2'>
            <Badge variant='outline' className='border-primary/20 text-primary'>
              {currentSlideData.badge}
            </Badge>
          </div>
        </div>

        <div className='relative min-h-[400px] mb-6'>
          {currentSlideData.content}
        </div>

        {/* Carousel navigation dots */}
        <div className='flex justify-center space-x-2 mb-4 relative'>
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

        {/* Navigation buttons */}
        <Button
          variant='ghost'
          size='icon'
          className='absolute left-4 top-1/2 -translate-y-1/2 h-8 w-8 opacity-60 hover:opacity-100 z-10'
          onClick={prevSlide}
        >
          <ChevronLeft className='h-4 w-4' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 opacity-60 hover:opacity-100 z-10'
          onClick={nextSlide}
        >
          <ChevronRight className='h-4 w-4' />
        </Button>
      </div>

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
