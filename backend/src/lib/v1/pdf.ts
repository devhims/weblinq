import type { z } from 'zod';

import { Buffer } from 'node:buffer';

import type { pdfInputSchema } from '@/routes/web/web.routes';

import { pageGotoWithRetry, runWithBrowser } from './browser-utils';

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
 * Browser-powered PDF generation (v1)
 * – Loads the given URL in a hardened headless Chromium session via BrowserManagerDO
 * – Optionally waits for `params.waitTime` ms after networkidle2
 * – Generates a PDF via `page.pdf()` using hardened defaults (binary buffer)
 * – Returns the PDF as a Uint8Array by default, or base64 string when requested
 */
export async function pdfV1(env: CloudflareBindings, params: PdfParams): Promise<PdfResult> {
  try {
    /* ════════════════ Launch & render ════════════════ */
    const pdfU8: Uint8Array = await runWithBrowser(env, async (page: any) => {
      /* Block heavy resources for performance */
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const type = req.resourceType();
        const shouldAbort = ['image', 'media', 'font'].includes(type);
        shouldAbort ? req.abort() : req.continue();
      });

      /* 1️⃣  Navigate & ensure render-ready with retry logic */
      await pageGotoWithRetry(page, params.url, { waitUntil: 'networkidle2', timeout: 30_000 });

      // Optional wait for a selector (legacy param – ignore if not present)
      if ((params as any).waitSelector) {
        try {
          await page.waitForSelector((params as any).waitSelector, { timeout: 10_000 });
        } catch {
          /* ignore timeout */
        }
      }

      // 🚦  Additional post-load delay if requested
      if (params.waitTime && params.waitTime > 0) {
        await new Promise((res) => setTimeout(res, params.waitTime));
      }

      // Ensure custom fonts are loaded
      await page.evaluateHandle(() => document.fonts.ready);

      // Apply print context for more accurate page size/colours
      await page.emulateMediaType('print');
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);

      // Ensure colour-accurate backgrounds
      await page.addStyleTag({ content: 'html{-webkit-print-color-adjust:exact}' });

      /* 2️⃣  Build PDF options with sane defaults */
      const pdfOpts = {
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      } as const;

      // page.pdf() returns a Node Buffer, which is a Uint8Array subclass
      return (await page.pdf(pdfOpts)) as Uint8Array;
    });

    // 🎯 Key optimization: Only encode to base64 when explicitly requested
    const payload = params.base64 ? Buffer.from(pdfU8).toString('base64') : pdfU8;

    const meta: PdfMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      size: pdfU8.byteLength,
    };

    return {
      success: true,
      data: {
        pdf: payload,
        metadata: meta,
      },
      creditsCost: CREDIT_COST,
    };
  } catch (err) {
    console.error('pdfV1 error', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
