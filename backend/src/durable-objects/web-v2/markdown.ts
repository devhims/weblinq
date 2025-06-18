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

import { runWithBrowser } from './browser-utils';

type MarkdownParams = z.infer<typeof markdownInputSchema>;
const words = (t: string) => (t.match(/\b\w+\b/g) ?? []).length;

/* One reusable processor */
const processor = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeRaw)
  .use(rehypeRemark)
  .use(remarkGfm)
  .use(() => (tree) => {
    /* 1️⃣  Remove paragraph duplicates of the subsequent heading */
    visit(tree, 'paragraph', (node: any, idx: number | null, parent: any) => {
      const next = parent!.children[idx! + 1];
      if (next?.type === 'heading') {
        const txt = toString(node).trim();
        const hTxt = toString(next).trim();
        if (txt === hTxt) parent!.children.splice(idx!, 1);
      }
    });

    /* 2️⃣  Strip links whose visible text is empty */
    visit(tree, 'link', (node: any, idx: number | null, parent: any) => {
      const text = toString(node).trim();
      if (!text) parent!.children.splice(idx!, 1);
    });

    /* 3️⃣  Collapse identical consecutive paragraphs (contact row dupes) */
    visit(tree, 'paragraph', (node: any, idx: number | null, parent: any) => {
      const prev = parent!.children[idx! - 1];
      if (prev?.type === 'paragraph' && toString(prev).trim() === toString(node).trim()) {
        parent!.children.splice(idx!, 1);
      }
    });

    /* 4️⃣  Remove trailing bare-text URLs that echo the previous link */
    visit(tree, 'paragraph', (node: any) => {
      if (node.children.length < 2) return;
      const last = node.children[node.children.length - 1];
      const prev = node.children[node.children.length - 2];
      if (last.type === 'text' && prev.type === 'link' && last.value.trim().startsWith(prev.url)) {
        node.children.pop();
        if (node.children[node.children.length - 1]?.type === 'text') {
          // trim extra space left behind
          (node.children[node.children.length - 1] as any).value = (
            node.children[node.children.length - 1] as any
          ).value.trim();
        }
      }
    });
  })
  .use(remarkStringify, { bullet: '*', fences: true, listItemIndent: 'one' });

export async function markdownV2(env: CloudflareBindings, params: MarkdownParams) {
  try {
    /* 1️⃣  Render page HTML */
    const html = await runWithBrowser(env, async (page) => {
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const shouldAbort = ['image', 'media', 'font', 'stylesheet'].includes(req.resourceType() as any);
        if (shouldAbort) {
          req.abort();
        } else {
          req.continue();
        }
      });
      await page.goto(params.url, { waitUntil: 'networkidle2', timeout: 30_000 });
      if (params.waitTime) await (page as any).waitForTimeout(params.waitTime);
      return page.content();
    });

    /* 2️⃣  Sanitize */
    const safeHtml = sanitizeHtml(html);

    /* 3️⃣  HTML → Markdown */
    let markdown = String(await processor.process(safeHtml));

    /* 4️⃣  Light post-cleanup */
    markdown = markdown.replace(/\n{3,}/g, '\n\n'); // collapse >2 blank lines

    /* 5️⃣  Response */
    return {
      success: true as const,
      data: {
        markdown,
        metadata: {
          url: params.url,
          timestamp: new Date().toISOString(),
          wordCount: words(markdown),
        },
      },
      creditsCost: Math.max(1, Math.ceil(markdown.length / 5_000)),
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
