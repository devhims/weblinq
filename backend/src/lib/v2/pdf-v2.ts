import type { z } from 'zod';

import { Buffer } from 'node:buffer';

import type { pdfInputSchema } from '@/routes/web/web.routes';
import type { Page } from '@cloudflare/playwright';

// Import v2 browser utilities for Playwright
import { hardenPageAdvanced, pageGotoWithRetry } from './browser-utils-v2';

// Reuse the request schema defined in web.routes.ts
export type PdfParams = z.infer<typeof pdfInputSchema> & {
  /** Return base64 string instead of raw binary Uint8Array */
  base64?: boolean;
};

interface PdfMetadata {
  url: string;
  timestamp: string;
  size: number;
}

interface PdfSuccess {
  success: true;
  data: {
    /** Uint8Array by default; base64 string when params.base64 === true */
    pdf: Uint8Array | string;
    metadata: PdfMetadata;
  };
  creditsCost: number;
}

interface PdfFailure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

export type PdfResult = PdfSuccess | PdfFailure;

const CREDIT_COST = 1;

/**
 * High-level PDF generation operation that handles page navigation and PDF creation.
 * Used by PlaywrightPoolDO.
 */
export async function pdfOperation(page: Page, params: PdfParams): Promise<PdfResult> {
  try {
    console.log(`📄 V2 PDF generation started for ${params.url}`);

    // Apply advanced hardening to avoid detection
    await hardenPageAdvanced(page);

    // Set up request interception for performance optimization
    // Only block heavy media resources, but keep images and fonts for proper rendering
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      // Only block heavy media resources that don't affect visual appearance
      const shouldAbort = ['media'].includes(resourceType);

      if (shouldAbort) {
        route.abort();
      } else {
        route.continue();
      }
    });

    // Navigate to the URL with retry logic
    console.log(`🌐 V2 PDF: Navigating to ${params.url}...`);
    await pageGotoWithRetry(page, params.url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // Optional wait for a selector (legacy param – ignore if not present)
    if ((params as any).waitSelector) {
      try {
        console.log(`⏳ V2 PDF: Waiting for selector ${(params as any).waitSelector}...`);
        await page.waitForSelector((params as any).waitSelector, { timeout: 10_000 });
      } catch {
        console.log(`⚠️ V2 PDF: Selector wait timeout ignored`);
        /* ignore timeout */
      }
    }

    // Additional post-load delay if requested
    if (params.waitTime && params.waitTime > 0) {
      console.log(`⏳ V2 PDF: Waiting ${params.waitTime}ms...`);
      await new Promise((res) => setTimeout(res, params.waitTime));
    }

    // Ensure custom fonts are loaded
    console.log(`🔤 V2 PDF: Ensuring fonts are loaded...`);
    await page.evaluate(() => document.fonts.ready);

    // Apply print context for more accurate page size/colours
    console.log(`🖨️ V2 PDF: Applying print context...`);
    await page.emulateMedia({ media: 'print' });
    await page.emulateMedia({
      reducedMotion: 'reduce',
    });

    // Ensure colour-accurate backgrounds
    await page.addStyleTag({ content: 'html{-webkit-print-color-adjust:exact}' });

    // Build PDF options with sane defaults
    console.log(`🔄 V2 PDF: Generating PDF...`);
    const pdfOpts = {
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    };

    // Generate PDF using Playwright
    const pdfBuffer = await page.pdf(pdfOpts);
    const pdfU8 = new Uint8Array(pdfBuffer);

    // Key optimization: Only encode to base64 when explicitly requested
    const payload = params.base64 ? Buffer.from(pdfU8).toString('base64') : pdfU8;

    const meta: PdfMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      size: pdfU8.byteLength,
    };

    console.log(`✅ V2 PDF generation successful for ${params.url}`, {
      size: pdfU8.byteLength,
      format: params.base64 ? 'base64' : 'binary',
    });

    return {
      success: true,
      data: {
        pdf: payload,
        metadata: meta,
      },
      creditsCost: CREDIT_COST,
    };
  } catch (err) {
    console.error('🚨 V2 PDF generation error:', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
