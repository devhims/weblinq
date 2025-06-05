import React from 'react';
import { Badge } from '@/components/ui/badge';
import { TextEffect } from '@/components/ui/text-effect';
import {
  Code,
  Camera,
  FileJson,
  Search,
  ChevronDown,
  Type,
  LinkIcon,
  FileImage,
  FileText,
  ArrowRight,
  Sparkles,
  Clock,
  Target,
  Zap,
} from 'lucide-react';

export function FeaturesSection() {
  return (
    <section
      id='features'
      className='pb-16 pt-16 md:pb-32 relative overflow-hidden'
    >
      {/* Background Elements */}
      <div className='absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background' />
      <div className='absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-r from-primary/5 to-primary/3 rounded-full blur-3xl' />
      <div className='absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-primary/3 to-primary/5 rounded-full blur-3xl' />

      <div className='mx-auto max-w-7xl px-6 relative'>
        <div className='text-center mb-20'>
          <div className='inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-6'>
            <Zap className='h-4 w-4 text-primary' />
            <span className='text-sm font-medium text-primary'>
              Powered by AI
            </span>
          </div>
          <TextEffect
            preset='fade-in-blur'
            speedSegment={0.3}
            as='h2'
            className='text-5xl md:text-6xl font-bold mb-6'
          >
            Powerful APIs for Web Data Extraction
          </TextEffect>
          <p className='text-xl text-muted-foreground max-w-3xl mx-auto'>
            Enterprise-grade APIs that transform any website into structured
            data
          </p>
        </div>

        <div className='grid lg:grid-cols-2 gap-8'>
          {/* Web Scraping */}
          <div className='group relative bg-muted/50 backdrop-blur-sm rounded-3xl border border-border/50 p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 flex flex-col min-h-[480px]'>
            <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/3 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

            <div className='flex items-start justify-between mb-6 relative'>
              <div className='flex items-center space-x-4'>
                <div className='p-3 bg-primary rounded-xl shadow-lg'>
                  <Code className='h-6 w-6 text-primary-foreground' />
                </div>
                <div>
                  <h3 className='text-2xl font-bold text-foreground mb-1'>
                    Web Scraping
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    CSS selectors, Markdown & JSON
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-2'>
                <Badge
                  variant='outline'
                  className='border-primary/20 text-primary'
                >
                  Advanced
                </Badge>
              </div>
            </div>

            <div className='border border-border/50 rounded-xl overflow-hidden mb-4 bg-card/50 backdrop-blur-sm flex-grow'>
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

            <div className='grid grid-cols-3 gap-3 mt-auto'>
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

          {/* Visual Capture */}
          <div className='group relative bg-muted/50 backdrop-blur-sm rounded-3xl border border-border/50 p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 flex flex-col min-h-[480px]'>
            <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/3 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

            <div className='flex items-start justify-between mb-6 relative'>
              <div className='flex items-center space-x-4'>
                <div className='p-3 bg-primary rounded-xl shadow-lg'>
                  <Camera className='h-6 w-6 text-primary-foreground' />
                </div>
                <div>
                  <h3 className='text-2xl font-bold text-foreground mb-1'>
                    Visual Capture
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    Screenshots & PDF
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-2'>
                <Badge
                  variant='outline'
                  className='border-primary/20 text-primary'
                >
                  4K Ready
                </Badge>
              </div>
            </div>

            <div className='border border-border/50 rounded-xl overflow-hidden mb-4 bg-card/50 backdrop-blur-sm flex-grow'>
              <div className='bg-muted/50 p-3 text-center border-b border-border/50'>
                <div className='flex items-center justify-center gap-2 mb-2'>
                  <div className='w-2 h-2 bg-primary rounded-full animate-pulse'></div>
                  <span className='text-sm font-medium text-foreground'>
                    Screenshot Result
                  </span>
                  <Badge variant='outline' className='text-xs'>
                    <Clock className='h-3 w-3 mr-1' />
                    ~150ms
                  </Badge>
                </div>
                <div className='text-xs text-muted-foreground font-mono'>
                  imageUrl:
                  &quot;https://api.weblinq.dev/screenshots/abc123.png&quot;
                </div>
              </div>
              <div className='p-6 text-center bg-gradient-to-br from-card to-primary/5 flex flex-col justify-center flex-grow'>
                <div className='p-4 bg-primary rounded-2xl inline-block mb-4 shadow-lg mx-auto'>
                  <Camera className='h-12 w-12 text-primary-foreground' />
                </div>
                <div className='text-lg font-bold text-foreground'>
                  1920×1080 Screenshot
                </div>
                <div className='text-sm text-muted-foreground'>
                  Full page capture
                </div>
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4 mt-auto'>
              <div className='flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card/70 hover:shadow-lg transition-all duration-300'>
                <div className='flex items-center space-x-3'>
                  <div className='p-2 bg-primary/10 rounded-lg'>
                    <FileText className='h-5 w-5 text-primary' />
                  </div>
                  <span className='text-sm font-medium text-foreground'>
                    PDF
                  </span>
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
                  <span className='text-sm font-medium text-foreground'>
                    PNG
                  </span>
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

          {/* Structured Data */}
          <div className='group relative bg-muted/50 backdrop-blur-sm rounded-3xl border border-border/50 p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 flex flex-col min-h-[480px]'>
            <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/3 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

            <div className='flex items-start justify-between mb-6 relative'>
              <div className='flex items-center space-x-4'>
                <div className='p-3 bg-primary rounded-xl shadow-lg'>
                  <FileJson className='h-6 w-6 text-primary-foreground' />
                </div>
                <div>
                  <h3 className='text-2xl font-bold text-foreground mb-1'>
                    Structured Data
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    AI-powered extraction
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-2'>
                <Badge
                  variant='outline'
                  className='border-primary/20 text-primary'
                >
                  <Target className='h-3 w-3 mr-1' />
                  99.8%
                </Badge>
              </div>
            </div>

            <div className='bg-gradient-to-br from-gray-900 to-black rounded-xl p-4 font-mono text-sm border border-gray-800 mb-4 shadow-2xl flex-grow'>
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
                  <span className='text-blue-400'>
                    &quot;availability&quot;
                  </span>
                  :<span className='text-yellow-400'> true</span>
                </div>
                <div className='text-gray-300'>{'}'}</div>
              </div>
            </div>

            <div className='grid grid-cols-3 gap-4 text-center mt-auto'>
              <div className='p-4 bg-card/70 rounded-xl border border-border/50'>
                <div className='text-2xl font-bold text-primary mb-1'>15ms</div>
                <div className='text-xs text-muted-foreground'>Processing</div>
              </div>
              <div className='p-4 bg-card/70 rounded-xl border border-border/50'>
                <div className='text-2xl font-bold text-primary mb-1'>
                  99.8%
                </div>
                <div className='text-xs text-muted-foreground'>Accuracy</div>
              </div>
              <div className='p-4 bg-card/70 rounded-xl border border-border/50'>
                <div className='text-2xl font-bold text-primary mb-1'>50+</div>
                <div className='text-xs text-muted-foreground'>Fields</div>
              </div>
            </div>
          </div>

          {/* Web Search */}
          <div className='group relative bg-muted/50 backdrop-blur-sm rounded-3xl border border-border/50 p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 flex flex-col min-h-[480px]'>
            <div className='absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/3 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

            <div className='flex items-start justify-between mb-6 relative'>
              <div className='flex items-center space-x-4'>
                <div className='p-3 bg-primary rounded-xl shadow-lg'>
                  <Search className='h-6 w-6 text-primary-foreground' />
                </div>
                <div>
                  <h3 className='text-2xl font-bold text-foreground mb-1'>
                    Web Search
                  </h3>
                  <p className='text-sm text-muted-foreground'>
                    Multi-engine aggregation
                  </p>
                </div>
              </div>
              <div className='flex items-center space-x-2'>
                <Badge
                  variant='outline'
                  className='border-primary/20 text-primary'
                >
                  <Sparkles className='h-3 w-3 mr-1' />
                  Global
                </Badge>
              </div>
            </div>

            <div className='bg-gradient-to-br from-gray-900 to-black rounded-xl p-4 font-mono text-xs border border-gray-800 mb-4 shadow-2xl flex-grow'>
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
                  <span className='text-blue-400'>
                    &quot;totalResults&quot;
                  </span>
                  :<span className='text-yellow-400'> 15</span>,
                </div>
                <div className='ml-3'>
                  <span className='text-blue-400'>&quot;searchTime&quot;</span>:
                  <span className='text-yellow-400'> 347</span>,
                </div>
                <div className='text-gray-300'>{'}'}</div>
              </div>
            </div>

            <div className='space-y-3 mt-auto'>
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
                {
                  name: 'DuckDuckGo',
                  status: 'Limited',
                  uptime: '95.2%',
                  color: 'bg-yellow-500',
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
        </div>
      </div>
    </section>
  );
}
