import type { z } from 'zod';

import type { markdownInputSchema } from '@/routes/web/web.routes';

import { runWithBrowser } from './browser-utils';

type MarkdownParams = z.infer<typeof markdownInputSchema>;

// Simple HTML → Markdown converter (same as in WebDurableObject)
function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```\n')
    .replace(/<br\s*\/?>(?=\s*<)/gi, '\n')
    .replace(/<[^>]*>/g, '') // strip remaining
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

export async function markdownV2(
  env: CloudflareBindings,
  params: MarkdownParams,
): Promise<{
  success: boolean;
  data: {
    markdown: string;
    metadata: {
      url: string;
      timestamp: string;
      wordCount: number;
    };
  };
  creditsCost: number;
}> {
  const html = await runWithBrowser(env, async (page) => {
    await page.goto(params.url, { waitUntil: 'networkidle0', timeout: 45_000 });
    if (params.waitTime && params.waitTime > 0) {
      await page.evaluate(
        (ms) => new Promise((res) => setTimeout(res, ms)),
        params.waitTime,
      );
    }
    return page.content();
  });

  const md = htmlToMarkdown(html);

  return {
    success: true,
    data: {
      markdown: md,
      metadata: {
        url: params.url,
        timestamp: new Date().toISOString(),
        wordCount: md.split(/\s+/).length,
      },
    },
    creditsCost: 1,
  };
}
