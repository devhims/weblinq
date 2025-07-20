import type { Heading, Link, Root as MdastRoot, Paragraph, Text } from 'mdast';

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
import console from 'node:console';

import type { Page } from '@cloudflare/playwright';

/* -------------------------------------------------------------------------- */
/*  Markdown Processing Types                                                 */
/* -------------------------------------------------------------------------- */

export interface MarkdownParams {
  url: string;
  waitTime?: number;
}

export interface MarkdownMetadata {
  url: string;
  timestamp: string;
  wordCount: number;
}

export interface MarkdownSuccess {
  success: true;
  data: {
    markdown: string;
    metadata: MarkdownMetadata;
  };
  creditsCost: number;
}

export interface MarkdownFailure {
  success: false;
  error: { message: string };
  creditsCost: 0;
}

export type MarkdownResult = MarkdownSuccess | MarkdownFailure;

/* -------------------------------------------------------------------------- */
/*  Markdown Processing Utilities                                             */
/* -------------------------------------------------------------------------- */

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
    .use(rehypeParse.default, { fragment: true })
    .use(rehypeRaw.default)
    .use(rehypeRemark.default)
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
    .use(remarkStringify.default, {
      bullet: '*',
      fences: true,
      listItemIndent: 'one',
    });
}

/**
 * Word counting function
 */
function words(str: string): number {
  return str.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * High-level markdown operation with fast content extraction
 * Uses targeted content selectors for better performance
 */
export async function markdownOperation(page: Page, params: MarkdownParams): Promise<MarkdownResult> {
  try {
    console.log(`📝 Fast markdown extraction starting for ${params.url}`);

    // Fallback to full page content if no targeted content found
    const content = await page.content();
    console.log(`📄 Using full page extraction, length: ${content.length} chars`);

    // Process to markdown
    return await processContentToMarkdown(content, params);
  } catch (err) {
    console.error('markdownOperation error', err);
    return {
      success: false as const,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}

/**
 * Process raw HTML content into markdown
 */
export async function processContentToMarkdown(content: string, params: MarkdownParams): Promise<MarkdownResult> {
  try {
    console.log(`📄 V2 Markdown: Processing content for ${params.url}...`);

    /* 2️⃣ Sanitize - lazy load sanitizeHtml */
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
    console.log(`🔄 V2 Markdown: Converting HTML to markdown...`);
    const processor = await createProcessor();
    const mdFile = await processor.process(safeHtml);
    let markdown = String(mdFile);
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    console.log(`✅ V2 Markdown: Conversion successful`, {
      originalSize: content.length,
      sanitizedSize: safeHtml.length,
      markdownSize: markdown.length,
      wordCount: words(markdown),
    });

    /* 4️⃣ Compose response */
    const meta: MarkdownMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      wordCount: words(markdown),
    };

    /* 5️⃣ Response */
    return {
      success: true as const,
      data: {
        markdown,
        metadata: meta,
      },
      creditsCost: 1,
    };
  } catch (err) {
    console.error('❌ V2 Markdown: processContentToMarkdown error', err);
    return {
      success: false as const,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
