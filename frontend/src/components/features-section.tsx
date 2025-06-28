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
  FileText,
  Sparkles,
  Clock,
  Target,
  Zap,
} from 'lucide-react';

export function FeaturesSection() {
  return (
    <section id="features" className="pb-16 pt-16 md:pb-24 lg:pb-32 relative overflow-hidden">
      {/* Background Elements - matching main page style */}
      <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]" />
      <div className="absolute top-1/4 left-1/4 w-48 h-48 md:w-96 md:h-96 bg-gradient-to-r from-primary/5 to-primary/3 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-1/4 right-1/4 w-48 h-48 md:w-96 md:h-96 bg-gradient-to-r from-primary/3 to-primary/5 rounded-full blur-3xl opacity-50" />

      <div className="mx-auto max-w-7xl px-6 relative">
        <div className="text-center mb-12 md:mb-16 lg:mb-20">
          {/* <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 mb-4 sm:mb-6">
            <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            <span className="text-xs sm:text-sm font-medium text-primary">Powered by AI</span>
          </div> */}
          <TextEffect
            preset="fade-in-blur"
            speedSegment={0.3}
            as="h2"
            className="text-3xl sm:text-3xl md:text-4xl lg:text-5xl font-medium mb-4 sm:mb-6"
          >
            Powerful APIs for Web Data Extraction
          </TextEffect>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
            Enterprise-grade APIs that transform any website into structured data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">
          {/* Web Scraping */}
          <div className="group relative bg-muted/50 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-border/50 p-4 sm:p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 flex flex-col min-h-[400px] md:min-h-[480px]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/3 rounded-2xl md:rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6 relative">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-0">
                <div className="p-2 sm:p-3 bg-primary rounded-xl shadow-lg">
                  <Code className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Web Scraping</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">CSS selectors, Markdown & JSON</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 self-start">
                <Badge variant="outline" className="border-primary/20 text-primary text-xs">
                  Advanced
                </Badge>
              </div>
            </div>

            <div className="border border-border/50 rounded-xl overflow-hidden mb-3 sm:mb-4 bg-card/50 backdrop-blur-sm flex-grow">
              <div className="flex border-b bg-muted/50 overflow-x-auto">
                <div className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm border-b-2 border-primary text-primary bg-card/80 whitespace-nowrap">
                  Selectors
                </div>
                <div className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                  Markdown
                </div>
                <div className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
                  JSON
                </div>
              </div>

              <div className="p-3 sm:p-4">
                <div className="bg-muted/50 rounded-lg border border-border/50">
                  <div className="p-2 sm:p-3 flex items-center justify-between border-b border-border/50">
                    <div className="flex items-center min-w-0">
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-muted-foreground flex-shrink-0" />
                      <code className="text-xs sm:text-sm font-mono bg-primary/10 text-primary px-1.5 sm:px-2 py-0.5 sm:py-1 rounded truncate">
                        h1.title
                      </code>
                      <span className="ml-1 sm:ml-2 text-xs sm:text-sm text-muted-foreground">(3)</span>
                    </div>
                  </div>
                  <div className="p-2 sm:p-3">
                    <div className="bg-card p-2 sm:p-3 rounded-lg border border-border/50">
                      <div className="flex items-center mb-2">
                        <Type className="h-3 w-3 sm:h-4 sm:w-4 text-primary mr-2 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-medium text-foreground">Text Content</span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground font-mono break-words">
                        &quot;Welcome to Modern Web Development&quot;
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-auto">
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
                  className="flex flex-col items-center space-y-1 sm:space-y-2 p-2 sm:p-3 rounded-xl bg-card/70 border border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg border border-primary/20">
                    <preset.icon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-xs text-foreground">{preset.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual Capture */}
          <div className="group relative bg-muted/50 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-border/50 p-4 sm:p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 flex flex-col min-h-[400px] md:min-h-[480px]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/3 rounded-2xl md:rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6 relative">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-0">
                <div className="p-2 sm:p-3 bg-primary rounded-xl shadow-lg">
                  <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Visual Capture</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Screenshots & PDF</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 self-start">
                <Badge variant="outline" className="border-primary/20 text-primary text-xs">
                  4K Ready
                </Badge>
              </div>
            </div>

            <div className="border border-border/50 rounded-xl overflow-hidden mb-3 sm:mb-4 bg-card/50 backdrop-blur-sm flex-grow">
              <div className="bg-muted/50 p-2 sm:p-3 text-center border-b border-border/50">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="text-xs sm:text-sm font-medium text-foreground">Screenshot Result</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    ~150ms
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono break-all">
                  imageUrl: &quot;...screenshots/abc123.png&quot;
                </div>
              </div>
              <div className="p-4 sm:p-6 text-center bg-gradient-to-br from-card to-primary/5 flex flex-col justify-center flex-grow">
                <div className="p-3 sm:p-4 bg-primary rounded-2xl inline-block mb-3 sm:mb-4 shadow-lg mx-auto">
                  <Camera className="h-8 w-8 sm:h-12 sm:w-12 text-primary-foreground" />
                </div>
                <div className="text-base sm:text-lg font-bold text-foreground">1920×1080 Screenshot</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Full page capture</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-auto">
              {[
                {
                  label: 'PDF',
                  icon: FileText,
                },
                {
                  label: 'PNG',
                  icon: Camera,
                },
                {
                  label: 'WEBP',
                  icon: Camera,
                },
              ].map((format) => (
                <div
                  key={format.label}
                  className="flex flex-col items-center space-y-1 sm:space-y-2 p-2 sm:p-3 rounded-xl bg-card/70 border border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                >
                  <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg border border-primary/20">
                    <format.icon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-xs text-foreground">{format.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Structured Data */}
          <div className="group relative bg-muted/50 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-border/50 p-4 sm:p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 flex flex-col min-h-[400px] md:min-h-[480px]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/3 rounded-2xl md:rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6 relative">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-0">
                <div className="p-2 sm:p-3 bg-primary rounded-xl shadow-lg">
                  <FileJson className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Structured Data</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">AI-powered extraction</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 self-start">
                <Badge variant="outline" className="border-primary/20 text-primary text-xs">
                  <Target className="h-3 w-3 mr-1" />
                  99.8%
                </Badge>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-3 sm:p-4 font-mono text-xs sm:text-sm border border-gray-800 mb-3 sm:mb-4 shadow-2xl flex-grow overflow-x-auto">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2 sm:gap-0">
                <div className="flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                  <span className="text-xs">{`// Live API Response`}</span>
                </div>
                <Badge variant="outline" className="text-xs self-start sm:self-center">
                  15ms avg
                </Badge>
              </div>
              <div className="space-y-1 text-xs sm:text-sm min-w-0">
                <div className="text-gray-300">{'{'}</div>
                <div className="ml-2 sm:ml-4 break-all">
                  <span className="text-blue-400">&quot;title&quot;</span>:
                  <span className="text-yellow-400"> &quot;MacBook Pro 16-inch&quot;</span>,
                </div>
                <div className="ml-2 sm:ml-4">
                  <span className="text-blue-400">&quot;price&quot;</span>:
                  <span className="text-yellow-400"> 2499.00</span>,
                </div>
                <div className="ml-2 sm:ml-4">
                  <span className="text-blue-400">&quot;currency&quot;</span>:
                  <span className="text-yellow-400"> &quot;USD&quot;</span>,
                </div>
                <div className="ml-2 sm:ml-4">
                  <span className="text-blue-400">&quot;availability&quot;</span>:
                  <span className="text-yellow-400"> true</span>
                </div>
                <div className="text-gray-300">{'}'}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center mt-auto">
              <div className="p-3 sm:p-4 bg-card/70 rounded-xl border border-border/50">
                <div className="text-lg sm:text-2xl font-bold text-primary mb-1">15ms</div>
                <div className="text-xs text-muted-foreground">Processing</div>
              </div>
              <div className="p-3 sm:p-4 bg-card/70 rounded-xl border border-border/50">
                <div className="text-lg sm:text-2xl font-bold text-primary mb-1">99.8%</div>
                <div className="text-xs text-muted-foreground">Accuracy</div>
              </div>
              <div className="p-3 sm:p-4 bg-card/70 rounded-xl border border-border/50">
                <div className="text-lg sm:text-2xl font-bold text-primary mb-1">50+</div>
                <div className="text-xs text-muted-foreground">Fields</div>
              </div>
            </div>
          </div>

          {/* Web Search */}
          <div className="group relative bg-muted/50 backdrop-blur-sm rounded-2xl md:rounded-3xl border border-border/50 p-4 sm:p-6 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500 hover:-translate-y-1 flex flex-col min-h-[400px] md:min-h-[480px]">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-primary/3 rounded-2xl md:rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 sm:mb-6 relative">
              <div className="flex items-center space-x-3 sm:space-x-4 mb-3 sm:mb-0">
                <div className="p-2 sm:p-3 bg-primary rounded-xl shadow-lg">
                  <Search className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-1">Web Search</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">Multi-engine aggregation</p>
                </div>
              </div>
              <div className="flex items-center space-x-2 self-start">
                <Badge variant="outline" className="border-primary/20 text-primary text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Global
                </Badge>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900 to-black rounded-xl p-3 sm:p-4 font-mono text-xs border border-gray-800 mb-3 sm:mb-4 shadow-2xl flex-grow overflow-x-auto">
              <div className="flex items-center mb-3">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                <span className="text-xs">{`// Multi-engine Search`}</span>
              </div>
              <div className="space-y-0.5 text-xs sm:text-sm min-w-0">
                <div className="text-gray-300">{'{'}</div>
                <div className="ml-2 sm:ml-3">
                  <span className="text-blue-400">&quot;results&quot;</span>: [
                  <span className="text-gray-500">{`/* 15 items */`}</span>],
                </div>
                <div className="ml-2 sm:ml-3">
                  <span className="text-blue-400">&quot;totalResults&quot;</span>:
                  <span className="text-yellow-400"> 15</span>,
                </div>
                <div className="ml-2 sm:ml-3">
                  <span className="text-blue-400">&quot;searchTime&quot;</span>:
                  <span className="text-yellow-400"> 347</span>,
                </div>
                <div className="text-gray-300">{'}'}</div>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3 mt-auto">
              <div className="text-xs sm:text-sm font-medium text-foreground mb-2 sm:mb-3">Engine Status</div>
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
                  className="flex items-center justify-between p-2 sm:p-3 rounded-xl border border-border/50 bg-card/70 hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                    <div className={`h-2 w-2 sm:h-3 sm:w-3 rounded-full ${engine.color} flex-shrink-0`} />
                    <div className="min-w-0">
                      <div className="font-medium text-xs sm:text-sm text-foreground truncate">{engine.name}</div>
                      <div className="text-xs text-muted-foreground">{engine.status}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs sm:text-sm font-bold text-foreground">{engine.uptime}</div>
                    <div className="text-xs text-muted-foreground">Uptime</div>
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
