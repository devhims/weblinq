import React from 'react';
import Link from 'next/link';
import { ArrowRight, Code, Check, CheckCheck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { TextEffect } from '@/components/ui/text-effect';
import { AnimatedGroup } from '@/components/ui/animated-group';
import { HeroHeader } from '@/components/header';
import { Logo } from '@/components/logo';
import { BorderBeam } from '@/components/magicui/border-beam';
import { FAQSection } from '@/components/faq-section';
import { FeaturesSection } from '@/components/features-section';
import { ScrollToFeaturesButton } from '@/components/scroll-to-features-button';
import {
  PRICING_PLANS,
  formatPrice,
  formatCredits,
} from '@/lib/utils/pricing-plans';

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      filter: 'blur(12px)',
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: 'blur(0px)',
      y: 0,
      transition: {
        type: 'spring',
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
};

export default async function HomePage() {
  return (
    <div className="min-h-screen">
      <HeroHeader />

      <main className="overflow-hidden">
        {/* Light beam gradient effects */}
        <div
          aria-hidden
          className="absolute inset-0 isolate hidden opacity-50 lg:block"
        >
          <div className="w-[35rem] h-[80rem] absolute left-0 top-0 -translate-y-[21.875rem] -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
          <div className="h-[80rem] absolute left-0 top-0 w-60 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] translate-x-[5%] -translate-y-[50%]" />
          <div className="h-[80rem] absolute left-0 top-0 w-60 -translate-y-[21.875rem] -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
        </div>

        {/* Hero Section */}
        <section>
          <div className="relative pt-24 md:pt-36">
            <AnimatedGroup
              variants={{
                container: {
                  visible: {
                    transition: {
                      delayChildren: 1,
                    },
                  },
                },
                item: {
                  hidden: {
                    opacity: 0,
                    y: 20,
                  },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      type: 'spring',
                      bounce: 0.3,
                      duration: 2,
                    },
                  },
                },
              }}
              className="absolute inset-0 -z-20"
            >
              <div className="absolute inset-x-0 top-56 -z-20 lg:top-32">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
              </div>
            </AnimatedGroup>

            <div className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]" />

            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                <AnimatedGroup variants={transitionVariants}>
                  <div className="relative overflow-hidden rounded-full w-fit mx-auto">
                    <Link
                      href="/dashboard/studio"
                      className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-zinc-950/5 transition-colors duration-300 dark:border-t-white/5 dark:shadow-zinc-950"
                    >
                      <span className="text-foreground text-sm">
                        Explore Studio
                      </span>
                      <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700" />
                      <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                        <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                          <span className="flex size-6">
                            <ArrowRight className="m-auto size-3" />
                          </span>
                          <span className="flex size-6">
                            <ArrowRight className="m-auto size-3" />
                          </span>
                        </div>
                      </div>
                    </Link>
                    <BorderBeam
                      duration={5}
                      size={60}
                      reverse
                      className="from-transparent via-orange-400 to-transparent"
                    />
                  </div>
                </AnimatedGroup>

                <TextEffect
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  as="h1"
                  className="mt-8 font-medium text-balance text-4xl md:text-6xl lg:mt-16 xl:text-7xl"
                >
                  Linking AI agents to the web
                </TextEffect>

                <TextEffect
                  per="line"
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  delay={0.5}
                  as="p"
                  className="mx-auto mt-8 max-w-4xl text-balance text-sm md:text-lg"
                >
                  Extract data, capture screenshots, and search the internet
                  with our web scraping and browser automation platform
                </TextEffect>

                <AnimatedGroup
                  variants={{
                    container: {
                      visible: {
                        transition: {
                          staggerChildren: 0.05,
                          delayChildren: 0.75,
                        },
                      },
                    },
                    ...transitionVariants,
                  }}
                  className="mt-12 flex flex-col items-center justify-center gap-2 md:flex-row"
                >
                  <div className="bg-foreground/10 rounded-[calc(var(--radius-xl)+0.125rem)] border p-0.5">
                    <Button
                      asChild
                      size="lg"
                      className="rounded-xl px-5 text-base"
                    >
                      <Link href="/dashboard/studio">
                        <Code className="mr-2 h-5 w-5" />
                        <span className="text-nowrap">Try API Studio</span>
                      </Link>
                    </Button>
                  </div>
                  <ScrollToFeaturesButton />
                </AnimatedGroup>
              </div>
            </div>

            <AnimatedGroup
              variants={{
                container: {
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                      delayChildren: 0.75,
                    },
                  },
                },
                ...transitionVariants,
              }}
            >
              <div className="relative -mr-56 mt-8 overflow-hidden px-2 sm:mr-0 sm:mt-12 md:mt-15">
                <div
                  aria-hidden
                  className="bg-linear-to-b to-background absolute inset-0 z-10 from-transparent from-35%"
                />
                <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background relative mx-auto max-w-6xl overflow-hidden rounded-2xl border p-4 shadow-lg shadow-zinc-950/15 ring-1">
                  {/* API Demo */}
                  <div className="bg-background rounded-xl p-4">
                    <div className="flex items-center space-x-2 mb-6">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                        <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                        <div className="w-3 h-3 bg-green-500 rounded-full" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-gray-900 to-black rounded-lg p-6 text-left border border-gray-800 shadow-2xl">
                      <div className="text-green-400 font-mono text-sm">
                        <div className="text-gray-500 mb-2">{`// Scrape any website`}</div>
                        <div>
                          <span className="text-blue-400">POST</span>{' '}
                          <span className="text-gray-300">
                            https://api.weblinq.dev/v1/web/
                          </span>
                          <span className="text-yellow-400">markdown</span>{' '}
                        </div>

                        <div className="mt-3 ml-0">
                          <span className="text-gray-300">{'{'}</span>
                        </div>
                        <div className="ml-4">
                          <span className="text-blue-400">&quot;url&quot;</span>
                          <span className="text-gray-300">: </span>
                          <span className="text-green-400">
                            &quot;https://example.com&quot;
                          </span>
                        </div>

                        <div className="ml-0 text-gray-300">{'}'}</div>

                        <div className="mt-6 border-t border-gray-700 pt-4">
                          <div className="text-orange-400 flex items-center gap-2 mb-3">
                            <CheckCheck className="h-3 w-3" /> Response
                          </div>
                          <div className="text-gray-300 leading-relaxed">
                            <div className="text-purple-400">
                              # Example Domain
                            </div>
                            <div className="mt-2">
                              This domain is for use in illustrative examples in
                              documents. You may use this domain in literature
                              without prior coordination or asking for
                              permission.
                            </div>
                            <div className="mt-2">
                              <span className="text-blue-400">
                                [More information...]
                              </span>
                              <span className="text-gray-500">
                                (https://www.iana.org/domains/example)
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedGroup>
          </div>
        </section>

        <FeaturesSection />

        {/* Pricing Section */}
        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center mb-16">
              <TextEffect
                preset="fade-in-blur"
                speedSegment={0.3}
                as="h2"
                className="text-4xl font-bold mb-4"
              >
                Simple, Transparent Pricing
              </TextEffect>
              <p className="text-muted-foreground text-lg">
                Choose the plan that fits your needs
              </p>
            </div>

            <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-8 backdrop-blur-sm relative flex flex-col ${
                    plan.highlighted
                      ? 'border-primary/30 bg-primary/10'
                      : plan.id === 'free'
                        ? 'bg-muted/50'
                        : 'bg-muted/50'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
                        Most Popular
                      </Badge>
                    </div>
                  )}

                  <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      {plan.icon ? (
                        <plan.icon className="h-6 w-6 text-primary" />
                      ) : (
                        <User className="h-6 w-6 text-primary" />
                      )}
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                    </div>
                    <div className="text-4xl font-bold mb-2">
                      {formatPrice(plan.price)}
                      {plan.price !== null && plan.price > 0 && (
                        <span className="text-lg text-muted-foreground">
                          /month
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">
                      {plan.id === 'free'
                        ? 'Free forever'
                        : plan.credits
                          ? `${formatCredits(plan.credits)} API requests`
                          : 'Unlimited usage'}
                    </p>
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.slice(0, 6).map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <Check className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    {plan.type === 'free' && (
                      <Button variant="outline" className="w-full">
                        Get Started
                      </Button>
                    )}

                    {plan.type === 'subscription' && (
                      <Button className="w-full">Subscribe →</Button>
                    )}

                    {plan.type === 'contact' && (
                      <Button variant="outline" className="w-full">
                        Contact Sales
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <FAQSection />
      </main>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Logo className="h-10" />
              </div>
              <p className="text-muted-foreground mb-4">
                Professional web scraping API platform built for developers and
                enterprises.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Refund Policy
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Links</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li>
                  <Link
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Support
                  </Link>
                </li>
                <li>
                  <Link
                    href="#"
                    className="hover:text-foreground transition-colors"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    href="/dashboard/studio"
                    className="hover:text-foreground transition-colors"
                  >
                    API Studio
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-muted-foreground text-sm">
                © 2025 Weblinq. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
