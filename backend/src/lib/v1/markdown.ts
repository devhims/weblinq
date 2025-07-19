import type { Heading, Link, Root as MdastRoot, Paragraph, Text } from 'mdast';
import type { z } from 'zod';

// Lazy imports to avoid heavy startup parsing
// import { toString } from 'mdast-util-to-string';
// import rehypeParse from 'rehype-parse';
// import rehypeRaw from 'rehype-raw';
// import rehypeRemark from 'rehype-remark';
// import remarkGfm from 'remark-gfm';
// import remarkStringify from 'remark-stringify';
// import sanitizeHtml from 'sanitize-html';
// import { unified } from 'unified';
// import { visit } from 'unist-util-visit';
import type { markdownInputSchema } from '@/routes/web/web.routes';

import { pageGotoWithRetry, runWithBrowser } from './browser-utils';

type MarkdownParams = z.infer<typeof markdownInputSchema>;

interface MarkdownMetadata {
  url: string;
  timestamp: string;
  wordCount: number;
}

interface MarkdownSuccess {
  success: true;
  data: {
    markdown: string;
    metadata: MarkdownMetadata;
  };
  creditsCost: number;
}

interface MarkdownFailure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

type MarkdownResult = MarkdownSuccess | MarkdownFailure;

/**
 * Word counting function
 */
function words(str: string): number {
  return str.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Lazy-loaded processor creation to avoid heavy startup
 */
async function createProcessor() {
  const [rehypeParse, rehypeRaw, rehypeRemark, remarkGfm, remarkStringify, { unified }, { visit }] = await Promise.all([
    import('rehype-parse'),
    import('rehype-raw'),
    import('rehype-remark'),
    import('remark-gfm'),
    import('remark-stringify'),
    import('unified'),
    import('unist-util-visit'),
  ]);

  return unified()
    .use(rehypeParse.default)
    .use(rehypeRaw.default)
    .use(rehypeRemark.default, { handlers: {} })
    .use(remarkGfm.default)
    .use(() => (tree: MdastRoot) => {
      visit(tree, (node: any) => {
        // Clean up heading levels to only use h1-h6
        if (node.type === 'heading' && node.depth > 6) {
          node.depth = 6;
        }

        // Fix link URLs - make relative links absolute
        if (node.type === 'link' && node.url) {
          if (node.url.startsWith('//')) {
            node.url = `https:${node.url}`;
          } else if (node.url.startsWith('/')) {
            // Will be handled by the calling function with base URL
          }
        }
      });
    })
    .use(remarkStringify.default);
}

export async function markdownV1(env: CloudflareBindings, params: MarkdownParams): Promise<MarkdownResult> {
  try {
    const content = await runWithBrowser(env, async (page: any) => {
      // Block heavy resources for faster loading
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const shouldAbort = ['image', 'media', 'font', 'stylesheet'].includes(req.resourceType());
        shouldAbort ? req.abort() : req.continue();
      });

      await pageGotoWithRetry(page, params.url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

      if (params.waitTime && params.waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }

      return page.content();
    });

    /* 2️⃣  Sanitize - lazy load sanitizeHtml */
    const { default: sanitizeHtml } = await import('sanitize-html');
    const safeHtml = sanitizeHtml(content, {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      },
      allowedSchemes: ['http', 'https', 'data'],
    });

    /* 3️⃣ HTML → Markdown */
    const processor = await createProcessor();
    const mdFile = await processor.process(safeHtml);
    let markdown = String(mdFile);
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    /* 4️⃣ Compose response */
    const meta: MarkdownMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      wordCount: words(markdown),
    };

    /* 5️⃣  Response */
    return {
      success: true as const,
      data: {
        markdown,
        metadata: meta,
      },
      creditsCost: 1,
    };
  } catch (err) {
    console.error('markdownV1 error', err);
    return {
      success: false as const,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
