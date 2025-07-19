import type { Heading, Link, Root as MdastRoot, Paragraph, Text } from 'mdast';

import { toString } from 'mdast-util-to-string';
import rehypeParse from 'rehype-parse';
import rehypeRaw from 'rehype-raw';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import sanitizeHtml from 'sanitize-html';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

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

const words = (t: string) => (t.match(/\b\w+\b/g) ?? []).length;

/**
 * High-level markdown operation that handles page content extraction
 * and processes it to markdown. Used by PlaywrightPoolDO.
 */
export async function markdownOperation(page: Page, params: MarkdownParams): Promise<MarkdownResult> {
  try {
    // Extract page content
    const content = await page.content();
    console.log(`📝 Extracted content, length: ${content.length} chars`);

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
    /* Sanitize */
    const safeHtml = sanitizeHtml(content, {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      },
      allowedSchemes: ['http', 'https', 'data'],
    });

    /* HTML → Markdown */
    const mdFile = await processor.process(safeHtml);
    let markdown = String(mdFile);
    markdown = markdown.replace(/\n{3,}/g, '\n\n');

    /* Compose response */
    const meta: MarkdownMetadata = {
      url: params.url,
      timestamp: new Date().toISOString(),
      wordCount: words(markdown),
    };

    return {
      success: true as const,
      data: {
        markdown,
        metadata: meta,
      },
      creditsCost: 1,
    };
  } catch (err) {
    console.error('processContentToMarkdown error', err);
    return {
      success: false as const,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}

/* One reusable processor */
const processor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeRaw)
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(() => (tree: MdastRoot) => {
    /* ① Remove duplicate paragraph/heading pairs */
    visit<MdastRoot, 'paragraph'>(tree, 'paragraph', (node, idx, parent) => {
      if (idx === undefined || !parent) return;

      const paragraph = node;
      const next = parent.children[idx + 1] as Heading | undefined;

      if (next?.type === 'heading' && toString(paragraph).trim() === toString(next).trim()) {
        parent.children.splice(idx, 1);
      }
    });

    /* ② Strip links with empty visible text */
    visit<MdastRoot, 'link'>(tree, 'link', (node: Link, idx, parent) => {
      if (idx === undefined || !parent) return;
      if (!toString(node).trim()) parent.children.splice(idx, 1);
    });

    /* ③ Collapse identical consecutive paragraphs */
    visit<MdastRoot, 'paragraph'>(tree, 'paragraph', (node, idx, parent) => {
      if (idx === undefined || !parent) return;
      const prev = parent.children[idx - 1] as Paragraph | undefined;
      if (prev?.type === 'paragraph' && toString(prev).trim() === toString(node).trim()) {
        parent.children.splice(idx, 1);
      }
    });

    /* ④ Remove echoed bare-URL after a link */
    visit<MdastRoot, 'paragraph'>(tree, 'paragraph', (node) => {
      if (node.children.length < 2) return;
      const last = node.children.at(-1) as Text;
      const prev = node.children.at(-2) as Link;
      if (last.type === 'text' && prev.type === 'link' && last.value.trim().startsWith(prev.url)) {
        node.children.pop();
        const tail = node.children.at(-1);
        if (tail && tail.type === 'text') tail.value = tail.value.trim();
      }
    });
  })
  .use(remarkStringify, {
    bullet: '*',
    fences: true,
    listItemIndent: 'one',
  });
