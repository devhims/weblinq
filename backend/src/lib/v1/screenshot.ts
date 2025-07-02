import type { z } from 'zod';

import { Buffer } from 'node:buffer';

import type { screenshotInputSchema } from '@/routes/web/web.routes';

import { pageGotoWithRetry, runWithBrowser } from './browser-utils';

type ScreenshotParams = z.infer<typeof screenshotInputSchema> & {
  /** Return base64 string instead of raw binary Uint8Array */
  base64?: boolean;
};

interface ScreenshotMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
  url: string;
  timestamp: string;
}

interface ScreenshotSuccess {
  success: true;
  data: {
    /** Uint8Array by default; base64 string when params.base64 === true */
    image: Uint8Array | string;
    metadata: ScreenshotMetadata;
  };
  creditsCost: number;
}

interface ScreenshotFailure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

export type ScreenshotResult = ScreenshotSuccess | ScreenshotFailure;

export async function screenshotV1(env: CloudflareBindings, params: ScreenshotParams): Promise<ScreenshotResult> {
  try {
    const viewportConfig = {
      width: params.viewport?.width ?? 1366,
      height: params.viewport?.height ?? 768,
      deviceScaleFactor: params.viewport?.deviceScaleFactor,
      hasTouch: params.viewport?.hasTouch,
      isLandscape: params.viewport?.isLandscape,
      isMobile: params.viewport?.isMobile,
    } as any;

    const screenshotOptions = {
      ...params.screenshotOptions,
      encoding: 'binary', // Always get binary from Puppeteer for optimization
    } as Record<string, any>;

    /* ════════════════ Launch & capture ════════════════ */
    const imageU8: Uint8Array = await runWithBrowser(env, async (page) => {
      // Configure viewport first
      await page.setViewport(viewportConfig);

      // Navigate to the page with retry logic for better resilience
      await pageGotoWithRetry(page, params.url, { waitUntil: 'networkidle0', timeout: 30_000 });

      // Wait for additional time if specified
      if (params.waitTime && params.waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }

      // Capture the screenshot as binary buffer
      const raw = (await page.screenshot(screenshotOptions)) as Buffer;
      return new Uint8Array(raw);
    });

    // 🎯 Key optimization: Only encode to base64 when explicitly requested
    const payload = params.base64 ? Buffer.from(imageU8).toString('base64') : imageU8;

    return {
      success: true,
      data: {
        image: payload,
        metadata: {
          width: viewportConfig.width,
          height: viewportConfig.height,
          format: params.screenshotOptions?.type ?? 'png',
          size: imageU8.byteLength,
          url: params.url,
          timestamp: new Date().toISOString(),
        },
      },
      creditsCost: 1, // mirror CREDIT_COSTS.screenshot
    };
  } catch (err) {
    console.error('screenshotV1 error', err);
    return {
      success: false,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
