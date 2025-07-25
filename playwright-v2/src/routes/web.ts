import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';

// Validation schemas
const markdownInputSchema = z.object({
  url: z.string().url('Invalid URL format'),
  waitTime: z.number().optional().default(0),
});

const screenshotInputSchema = z.object({
  url: z.string().url('Invalid URL format'),
  viewport: z
    .object({
      width: z.number().min(100).max(3840).optional().default(1920),
      height: z.number().min(100).max(2160).optional().default(1080),
    })
    .optional(),
  waitTime: z.number().optional().default(0),
  base64: z.boolean().optional().default(false),
});

const app = new Hono<{
  Bindings: CloudflareBindings;
}>();

// Markdown extraction endpoint
app.post(
  '/extract-markdown',
  zValidator('json', markdownInputSchema),
  async (c) => {
    try {
      const data = c.req.valid('json');
      const env = c.env;

      console.log(`📄 Markdown extraction request for: ${data.url}`);

      // Use PlaywrightPoolDO directly via RPC
      const poolId = env.PLAYWRIGHT_POOL_DO.idFromName('global');
      const poolStub = env.PLAYWRIGHT_POOL_DO.get(poolId);
      const result = await poolStub.extractMarkdown(data);

      if (result.success) {
        console.log(
          `✅ Markdown extraction successful. Word count: ${result.data.metadata.wordCount}`,
        );
        return c.json(result);
      } else {
        console.error(`❌ Markdown extraction failed: ${result.error.message}`);
        return c.json(result, 500);
      }
    } catch (error) {
      console.error('Unexpected error in markdown extraction:', error);
      return c.json(
        {
          success: false,
          error: { message: 'Internal server error' },
          creditsCost: 0,
        },
        500,
      );
    }
  },
);

// Screenshot endpoint
app.post(
  '/screenshot',
  zValidator('json', screenshotInputSchema),
  async (c) => {
    try {
      const data = c.req.valid('json');
      const env = c.env;

      console.log(`📸 Screenshot request for: ${data.url}`);

      // Use PlaywrightPoolDO directly via RPC
      const poolId = env.PLAYWRIGHT_POOL_DO.idFromName('global');
      const poolStub = env.PLAYWRIGHT_POOL_DO.get(poolId);
      const result = await poolStub.takeScreenshot(data);

      if (result.success) {
        console.log(`✅ Screenshot successful for: ${data.url}`);

        // If base64 requested, return JSON
        if (data.base64) {
          return c.json(result);
        }

        // Return binary image data
        return new Response(result.data.image as ArrayBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Content-Disposition': `attachment; filename="screenshot-${Date.now()}.png"`,
          },
        });
      } else {
        console.error(`❌ Screenshot failed: ${result.error.message}`);
        return c.json(result, 500);
      }
    } catch (error) {
      console.error('Unexpected error in screenshot:', error);
      return c.json(
        {
          success: false,
          error: { message: 'Internal server error' },
          creditsCost: 0,
        },
        500,
      );
    }
  },
);

app.get('/stats', async (c) => {
  const poolId = c.env.PLAYWRIGHT_POOL_DO.idFromName('global');
  const poolStub = c.env.PLAYWRIGHT_POOL_DO.get(poolId);
  return c.json(await poolStub.getStats());
});

export default app;
