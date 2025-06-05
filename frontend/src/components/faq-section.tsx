'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { TextEffect } from '@/components/ui/text-effect';

const faqData = [
  {
    question: 'Is Weblinq API Free?',
    answer:
      'Yes! Weblinq offers a generous free tier with 1,000 API requests per month. Perfect for getting started and testing our service.',
  },
  {
    question: 'How does the API ensure reliability?',
    answer:
      'Our API uses advanced infrastructure with global proxy networks, automatic retries, and intelligent rate limiting to ensure consistent performance.',
  },
  {
    question: 'What response formats are supported?',
    answer:
      'Our API supports multiple formats including JSON, Markdown, HTML, screenshots (PNG), PDFs, and structured data extraction.',
  },
  {
    question: 'Do you have customer support?',
    answer:
      'Yes! We provide 24/7 customer support for Pro and Enterprise plans. Free tier users have access to our community support forum.',
  },
  {
    question: 'How do I get started with the API?',
    answer:
      'Simply sign up for a free account, get your API key, and start making requests. Check our API Studio for interactive testing and documentation.',
  },
];

export function FAQSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section className='py-20'>
      <div className='mx-auto max-w-4xl px-6'>
        <div className='text-center mb-16'>
          <TextEffect
            preset='fade-in-blur'
            speedSegment={0.3}
            as='h2'
            className='text-4xl font-bold mb-4'
          >
            Frequently Asked Questions
          </TextEffect>
          <p className='text-muted-foreground'>
            Have more questions? Visit our{' '}
            <Link href='#' className='text-primary hover:underline'>
              help center
            </Link>{' '}
            for additional guides and support.
          </p>
        </div>

        <div className='space-y-4'>
          {faqData.map((faq, index) => (
            <div
              key={index}
              className='bg-muted/50 rounded-lg border backdrop-blur-sm'
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className='w-full px-6 py-4 text-left flex items-center justify-between hover:bg-muted/50 transition-colors rounded-lg'
              >
                <span className='font-medium'>{faq.question}</span>
                <ChevronDown
                  className={`h-5 w-5 transition-transform ${
                    openFaq === index ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openFaq === index && (
                <div className='px-6 pb-4'>
                  <p className='text-muted-foreground'>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
