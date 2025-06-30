import type { Heading, Link, Root as MdastRoot, Paragraph, Text } from 'mdast';
import type { z } from 'zod';

import { toString } from 'mdast-util-to-string';
import rehypeParse from 'rehype-parse';
import rehypeRaw from 'rehype-raw';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import sanitizeHtml from 'sanitize-html';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

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

const words = (t: string) => (t.match(/\b\w+\b/g) ?? []).length;

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

export async function markdownV2(env: CloudflareBindings, params: MarkdownParams): Promise<MarkdownResult> {
  try {
    const content = await runWithBrowser(env, async (page: any) => {
      // Block heavy resources for faster loading
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const shouldAbort = ['image', 'media', 'font', 'stylesheet'].includes(req.resourceType());
        shouldAbort ? req.abort() : req.continue();
      });

      // Navigate with retry logic for better resilience
      await pageGotoWithRetry(page, params.url, { waitUntil: 'networkidle2', timeout: 30_000 });

      if (params.waitTime && params.waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, params.waitTime));
      }

      return page.content();
    });

    /* 2️⃣  Sanitize */
    const safeHtml = sanitizeHtml(content, {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
      allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      },
      allowedSchemes: ['http', 'https', 'data'],
    });

    /* 3️⃣ HTML → Markdown */
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
    console.error('markdownV2 error', err);
    return {
      success: false as const,
      error: { message: String(err) },
      creditsCost: 0,
    };
  }
}
