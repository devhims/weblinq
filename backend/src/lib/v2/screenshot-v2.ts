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
  screenshotOptions?: {
    captureBeyondViewport?: boolean;
    clip?: {
      height: number;
      width: number;
      x: number;
      y: number;
      scale?: number;
    };
    encoding?: 'binary' | 'base64';
    fromSurface?: boolean;
    fullPage?: boolean;
    omitBackground?: boolean;
    optimizeForSpeed?: boolean;
    quality?: number;
    type?: 'png' | 'jpeg' | 'webp';
  };
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
  type: 'png' | 'jpeg' | 'webp';
  quality?: number;
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
/*  Screenshot Operation - Optimized for Speed with Full Format Support      */
/* -------------------------------------------------------------------------- */

/**
 * Enhanced screenshot operation with full format support and speed optimization.
 * Supports PNG, JPEG, WEBP with comprehensive options matching V1.
 * Assumes page is already navigated by PlaywrightPoolDO.
 */
export async function screenshotOperation(page: Page, params: ScreenshotParams): Promise<ScreenshotResult> {
  try {
    console.log(`📸 V2 Screenshot started for ${params.url}`);

    // Set viewport (page is already navigated by PlaywrightPoolDO)
    const viewport = {
      width: params.viewport?.width || 1920,
      height: params.viewport?.height || 1080,
    };
    await page.setViewportSize(viewport);
    console.log(`📏 Set viewport to ${viewport.width}x${viewport.height}`);

    // Extract screenshot options with V1-compatible defaults
    const options = params.screenshotOptions || {};
    const imageType = options.type || 'png'; // Default to PNG like V1
    const fullPage = options.fullPage !== undefined ? options.fullPage : true; // Default to full page like V1
    const quality = options.quality;
    const optimizeForSpeed = options.optimizeForSpeed || false;

    // Build Playwright screenshot options
    const screenshotOptions: any = {
      type: imageType,
      scale: 'css' as const, // Preserve CSS scaling
      fullPage,
    };

    // Add quality only for JPEG and WEBP
    if ((imageType === 'jpeg' || imageType === 'webp') && quality !== undefined) {
      screenshotOptions.quality = quality;
    }

    // Handle speed optimization (inspired by playwright-mcp-main but keeping format flexibility)
    if (optimizeForSpeed && imageType === 'jpeg' && !quality) {
      screenshotOptions.quality = 50; // Use low quality for speed like playwright-mcp-main
    }

    // Add other advanced options
    if (options.omitBackground) {
      screenshotOptions.omitBackground = options.omitBackground;
    }
    if (options.clip) {
      screenshotOptions.clip = options.clip;
    }

    console.log(`📸 Taking screenshot with options:`, {
      type: imageType,
      fullPage,
      quality: screenshotOptions.quality,
      optimizeForSpeed,
    });

    const screenshot = await page.screenshot(screenshotOptions);
    console.log(`✅ Screenshot captured, size: ${screenshot.byteLength} bytes, format: ${imageType}`);

    // Compose response metadata
    const metadata: ScreenshotMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      viewport,
      format: imageType, // Keep for backwards compatibility
      type: imageType,
      size: screenshot.byteLength,
      fullPage,
      ...(screenshotOptions.quality && { quality: screenshotOptions.quality }),
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
    console.error('🚨 V2 Screenshot operation error:', err);
    return {
      success: false as const,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
