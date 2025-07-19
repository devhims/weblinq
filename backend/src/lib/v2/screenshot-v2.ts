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
}

interface ScreenshotMetadata {
  url: string;
  timestamp: string;
  viewport: {
    width: number;
    height: number;
  };
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
/*  Screenshot Operation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * High-level screenshot operation that handles viewport setup and image capture.
 * Used by PlaywrightPoolDO.
 */
export async function screenshotOperation(page: Page, params: ScreenshotParams): Promise<ScreenshotResult> {
  try {
    // Set viewport
    const viewport = {
      width: params.viewport?.width || 1920,
      height: params.viewport?.height || 1080,
    };
    await page.setViewportSize(viewport);
    console.log(`📏 Set viewport to ${viewport.width}x${viewport.height}`);

    // Take screenshot
    console.log(`📸 Taking screenshot...`);
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false, // Only visible area
    });

    console.log(`✅ Screenshot captured, size: ${screenshot.byteLength} bytes`);

    // Compose response metadata
    const metadata: ScreenshotMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      viewport,
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
    console.error('screenshotOperation error', err);
    return {
      success: false as const,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
