import type { Page } from '@cloudflare/playwright';

/* -------------------------------------------------------------------------- */
/*  Screenshot Processing Types                                               */
/* -------------------------------------------------------------------------- */

export interface ScreenshotParams {
  url: string;
  viewport?: {
    width?: number;
    height?: number;
  };
  waitTime?: number;
  base64?: boolean;
  fullPage?: boolean; // Add full page option
  quality?: number; // Add quality option (1-100, only for JPEG)
}

interface ScreenshotMetadata {
  url: string;
  timestamp: string;
  viewport: {
    width: number;
    height: number;
  };
  format: string;
  size: number;
  fullPage: boolean;
}

interface ScreenshotSuccess {
  success: true;
  data: {
    image: ArrayBuffer | string; // ArrayBuffer for binary, string for base64
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

/* -------------------------------------------------------------------------- */
/*  Screenshot Operation - Optimized for Speed                               */
/* -------------------------------------------------------------------------- */

/**
 * Fast screenshot operation optimized for speed following playwright-mcp-main approach.
 * Assumes page is already navigated by PlaywrightPoolDO.
 */
export async function screenshotOperation(page: Page, params: ScreenshotParams): Promise<ScreenshotResult> {
  try {
    console.log(`📸 Fast Screenshot started for ${params.url}`);

    // Set viewport (page is already navigated by PlaywrightPoolDO)
    const viewport = {
      width: params.viewport?.width || 1920,
      height: params.viewport?.height || 1080,
    };
    await page.setViewportSize(viewport);
    console.log(`📏 Set viewport to ${viewport.width}x${viewport.height}`);

    // Fast screenshot with optimized settings (like playwright-mcp-main)
    console.log(`📸 Taking fast screenshot...`);
    const screenshotOptions = {
      type: 'jpeg' as const, // JPEG is much faster than PNG
      quality: params.quality || 50, // Low quality for speed (like playwright-mcp-main)
      scale: 'css' as const, // Preserve CSS scaling
      fullPage: params.fullPage || false, // Viewport only by default for speed
    };

    const screenshot = await page.screenshot(screenshotOptions);
    console.log(`✅ Fast screenshot captured, size: ${screenshot.byteLength} bytes`);

    // Compose response metadata
    const metadata: ScreenshotMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      viewport,
      format: 'jpeg',
      size: screenshot.byteLength,
      fullPage: screenshotOptions.fullPage,
    };

    // Convert to base64 if requested
    if (params.base64) {
      const uint8Array = new Uint8Array(screenshot);
      const base64String = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
      return {
        success: true as const,
        data: {
          image: base64String,
          metadata,
        },
        creditsCost: 1,
      };
    }

    // Return binary data (convert to ArrayBuffer)
    let arrayBuffer: ArrayBuffer;
    if (screenshot instanceof ArrayBuffer) {
      arrayBuffer = screenshot;
    } else {
      arrayBuffer = new ArrayBuffer(screenshot.byteLength);
      new Uint8Array(arrayBuffer).set(new Uint8Array(screenshot));
    }

    return {
      success: true as const,
      data: {
        image: arrayBuffer,
        metadata,
      },
      creditsCost: 1,
    };
  } catch (err) {
    console.error('🚨 Fast Screenshot operation error:', err);
    return {
      success: false as const,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
