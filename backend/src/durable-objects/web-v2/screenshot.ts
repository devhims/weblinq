import type { z } from 'zod';

import { Buffer } from 'node:buffer';

import type { screenshotInputSchema } from '@/routes/web/web.routes';

import { runWithBrowser } from './browser-utils';

type ScreenshotParams = z.infer<typeof screenshotInputSchema>;

export async function screenshotV2(
  env: CloudflareBindings,
  params: ScreenshotParams,
): Promise<{
  success: boolean;
  data: {
    image: string;
    metadata: {
      width: number;
      height: number;
      format: string;
      size: number;
      url: string;
      timestamp: string;
    };
  };
  creditsCost: number;
}> {
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
    encoding: params.screenshotOptions?.encoding ?? 'binary',
  } as Record<string, any>;

  const raw = await runWithBrowser(env, async (page) => {
    // Configure viewport first
    await page.setViewport(viewportConfig);

    // Navigate to the page
    await page.goto(params.url, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    });

    // Wait for additional time if specified
    if (params.waitTime && params.waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, params.waitTime));
    }

    // Capture the screenshot. The returned value can be Buffer or base64 string depending on encoding.
    return (await page.screenshot(screenshotOptions)) as Buffer | string;
  });

  // Ensure we always return a base64 image string as per API contract
  const base64Image = typeof raw === 'string' ? raw : Buffer.from(raw).toString('base64');

  return {
    success: true,
    data: {
      image: base64Image,
      metadata: {
        width: viewportConfig.width,
        height: viewportConfig.height,
        format: params.screenshotOptions?.type ?? 'png',
        size: typeof raw === 'string' ? raw.length : (raw as Buffer).length,
        url: params.url,
        timestamp: new Date().toISOString(),
      },
    },
    creditsCost: 1, // mirror CREDIT_COSTS.screenshot
  };
}
