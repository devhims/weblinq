/*
 * unified-search.ts – three‑engine web scraper (DuckDuckGo, Startpage, Bing)
 * -------------------------------------------------------------------------
 * ▲ Robust against DDG 429s and Bing CAPTCHA pages.
 * ▲ Per‑engine + per‑IP rate‑limit (60/min).
 * ▲ 2‑second DDG throttle, mutex‑safe.
 * ▲ `Connection: keep-alive` and 20s timeout.
 * ▲ UA + Accept‑Language rotation.
 * ▲ Logs:
 *     • each scraper prints result count
 *     • if zero, prints first 1kB of HTML so you can inspect challenges/blocks
 *     • orchestrator prints merged summary
 */

// --------------------------------------------------
// Imports + types
// --------------------------------------------------
// Lazy import to avoid heavy startup parsing
// import * as cheerio from 'cheerio';
// import { z } from 'zod';

// export const SearchResultSchema = z.object({
//   title: z.string(),
//   url: z.string().url(),
//   snippet: z.string(),
//   source: z.enum(['duckduckgo', 'startpage', 'bing']),
// });
// export const SearchParamsSchema = z.object({
//   query: z.string().min(1).max(500),
//   limit: z.number().min(1).max(50).optional().default(10),
//   clientIp: z.string().optional(),
// });
// export type SearchResult = z.infer<typeof SearchResultSchema>;
// export type SearchParams = z.infer<typeof SearchParamsSchema>;
// export interface SearchResponse {
//   results: SearchResult[];
//   totalResults: number;
//   searchTime: number;
//   sources: string[];
// }

// // --------------------------------------------------
// // Helpers: per‑engine buckets, delay, fetch‑retry
// // --------------------------------------------------
// const WINDOW_MS = 60_000;
// const MAX_REQ = 60;
// interface Bucket {
//   c: number;
//   reset: number;
// }
// const buckets = new Map<string, Map<string, Bucket>>(); // ip → engine map
// function ok(ip: string, engine: string) {
//   if (!ip) return true;
//   const now = Date.now();
//   const be = buckets.get(ip) || buckets.set(ip, new Map()).get(ip)!;
//   const b = be.get(engine);
//   if (!b || now > b.reset) {
//     be.set(engine, { c: 1, reset: now + WINDOW_MS });
//     return true;
//   }
//   if (b.c >= MAX_REQ) return false;
//   b.c++;
//   return true;
// }
// const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// const UAS = [
//   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
//   'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
//   'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
//   'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
//   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
//   'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.0 Chrome/124 Mobile Safari/537.36',
//   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/124 Safari/537.36',
// ];
// const LANGS = ['en-US,en;q=0.9', 'en-GB,en;q=0.8', 'hi-IN,hi;q=0.7,en;q=0.5'];

// async function fetchRetry(url: string, init: RequestInit = {}, max = 2, timeoutMs = 20_000): Promise<Response> {
//   for (let a = 0; a <= max; a++) {
//     try {
//       const ctrl = new AbortController();
//       const tid = setTimeout(() => ctrl.abort(), timeoutMs);
//       const res = await fetch(url, {
//         ...init,
//         headers: {
//           'User-Agent': UAS[(Math.random() * UAS.length) | 0],
//           Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
//           'Accept-Language': LANGS[(Math.random() * LANGS.length) | 0],
//           Connection: 'keep-alive',
//           ...init.headers,
//         },
//         signal: ctrl.signal,
//       });
//       clearTimeout(tid);
//       if (!res.ok) throw new Error(`HTTP ${res.status}`);
//       return res;
//     } catch (err) {
//       if (a === max) throw err;
//       await sleep(1000 * 2 ** a);
//     }
//   }
//   throw new Error('unreachable');
// }

// // --------------------------------------------------
// // Text helpers
// // --------------------------------------------------
// const clean = (t: string) => t.replace(/\s+/g, ' ').trim();
// const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// function human(s: string) {
//   return s.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
// }
// function titleFromUrl(u: string) {
//   try {
//     const { hostname, pathname } = new URL(u);
//     const base = hostname.replace(/^www\./, '');
//     const seg = pathname.split('/').filter(Boolean).pop();
//     return seg ? `${cap(base)} – ${human(seg)}` : cap(base);
//   } catch {
//     return 'Search Result';
//   }
// }
// function snippetFromUrl(u: string, t: string) {
//   return `Result from ${t.toLowerCase().replace(' – ', ' about ')}`;
// }
// function ensureTitle(raw: string, url: string) {
//   const t = clean(raw);
//   return t.length > 2 && !t.startsWith('<') ? t : titleFromUrl(url);
// }
// function ensureSnippet(raw: string, url: string, title: string) {
//   const s = clean(raw);
//   return s.length > 10 ? s : snippetFromUrl(url, title);
// }

// // --------------------------------------------------
// // 1. DuckDuckGo ----------------------------------------------------------------
// //   • First try the lite HTML (fast, no JS).
// //   • If no results found, fall back to the normal site and parse modern markup
// //     2025‑06 markup: <div class="result"> … <a class="result-link" …>
// // -----------------------------------------------------------------------------
// let lastDdg = 0;
// const ddgLock: Promise<any>[] = [];
// async function ddg(query: string, limit: number, ip: string): Promise<SearchResult[]> {
//   if (!ok(ip, 'duckduckgo')) return [];
//   let unlock!: () => void;
//   const wait = new Promise<void>((r) => (unlock = r));
//   ddgLock.push(wait);
//   while (ddgLock[0] !== wait) await ddgLock[0];
//   try {
//     const delta = Date.now() - lastDdg;
//     if (delta < 2000) await sleep(2000 - delta);
//     lastDdg = Date.now();
//     const liteURL = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
//     let html = await (await fetchRetry(liteURL)).text();
//     let results = await parseDdgLite(html, limit);

//     // Fallback to full site if lite variant returned none
//     if (!results.length) {
//       const fullURL = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en&ia=web`;
//       html = await (await fetchRetry(fullURL)).text();
//       results = await parseDdgFull(html, limit);
//       if (!results.length) console.warn('DDG empty, html preview:', html.slice(0, 1000));
//     }
//     console.log(`DDG → ${results.length}`);
//     return results;
//   } catch (err) {
//     console.error('DDG error', err);
//     return [];
//   } finally {
//     ddgLock.shift();
//     unlock();
//   }
// }
// async function parseDdgLite(html: string, limit: number): Promise<SearchResult[]> {
//   const cheerio = await import('cheerio');
//   const $ = cheerio.load(html);
//   const out: SearchResult[] = [];
//   $('tr').each((_, el) => {
//     if (out.length >= limit) return false;
//     const link = $(el).find('a[href]').first();
//     if (!link.length) return;
//     let href = link.attr('href') || '';
//     if (href.startsWith('/l/?uddg=')) href = decodeURIComponent(href.split('uddg=')[1]);
//     if (!href.startsWith('http')) return;
//     const title = ensureTitle(link.text(), href);
//     const raw = $(el).find('td').not(link).last().text() || $(el).find('td').last().text();
//     const snippet = ensureSnippet(raw, href, title);
//     out.push({ title, url: href, snippet, source: 'duckduckgo' });
//   });
//   return out;
// }
// async function parseDdgFull(html: string, limit: number): Promise<SearchResult[]> {
//   const cheerio = await import('cheerio');
//   const $ = cheerio.load(html);
//   const out: SearchResult[] = [];
//   $('.result, .result__body').each((_, el) => {
//     if (out.length >= limit) return false;
//     const link = $(el).find('a.result-link, a.result__a, a[href^="https"], a[href^="http"]').first();
//     if (!link.length) return;
//     const href = link.attr('href')!;
//     const title = ensureTitle(link.text(), href);
//     const raw = $(el).find('.result__snippet, .snippet, p').text();
//     const snippet = ensureSnippet(raw, href, title);
//     out.push({ title, url: href, snippet, source: 'duckduckgo' });
//   });
//   return out;
// }

// // 2. Startpage ----------------------------------------------------------------
// // --------------------------------------------------
// async function startpage(query: string, limit: number, ip: string): Promise<SearchResult[]> {
//   if (!ok(ip, 'startpage')) return [];
//   try {
//     const html = await (
//       await fetchRetry(`https://www.startpage.com/sp/search?query=${encodeURIComponent(query)}&cat=web&pl=opensearch`)
//     ).text();
//     const cheerio = await import('cheerio');
//     const $ = cheerio.load(html);
//     const out: SearchResult[] = [];
//     $('.w-gl__result,.result-item,.search-result,.result,article.result,[data-testid="result"]').each((_, el) => {
//       if (out.length >= limit) return false;
//       const link = $(el).find('a[data-testid="result-title-a"], a[href^="http"]').first();
//       if (!link.length) return;
//       const href = link.attr('href')!;
//       const cloned = link.clone();
//       cloned.find('img,svg').remove();
//       const title = ensureTitle(cloned.text(), href);
//       const raw = $(el).find('.w-gl__description,.result-snippet,[data-testid="result-content"],p').text();
//       const snippet = ensureSnippet(raw, href, title);
//       out.push({ title, url: href, snippet, source: 'startpage' });
//     });
//     console.log(`Startpage → ${out.length}`);
//     if (!out.length) console.warn('Startpage empty, html preview:', html.slice(0, 1000));
//     return out;
//   } catch (err) {
//     console.error('Startpage error', err);
//     return [];
//   }
// }

// // --------------------------------------------------
// // 3. Bing ---------------------------------------------------------------------
// //   • Handles normal markup + 2025 GLinkRedirect pattern
// //   • If .b_algo empty, fall back to <ol id="b_results"> li > a structure
// //   • CAPTCHA detector already in place
// // -----------------------------------------------------------------------------
// async function bing(query: string, limit: number, ip: string, retry = false): Promise<SearchResult[]> {
//   if (!ok(ip, 'bing')) return [];
//   try {
//     let html = await (
//       await fetchRetry(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
//         headers: { Referer: 'https://www.bing.com/' },
//       })
//     ).text();
//     if (!retry && (html.includes('verify you are a human') || html.includes('unusual traffic'))) {
//       console.warn('Bing CAPTCHA, retrying after 5s');
//       await sleep(5000);
//       return bing(query, limit, ip, true);
//     }
//     let results = await parseBing(html, limit);
//     if (!results.length) {
//       console.warn('Primary Bing selector empty; trying fallback parser');
//       results = await parseBingFallback(html, limit);
//       if (!results.length) {
//         console.warn('Fallback parser empty; trying generic parser');
//         results = await parseBingGeneric(html, limit);
//         if (!results.length) console.warn('Bing empty, html preview:', html.slice(0, 1000));
//       }
//     }
//     console.log(`Bing → ${results.length}`);
//     return results;
//   } catch (err) {
//     console.error('Bing error', err);
//     return [];
//   }
// }
// async function parseBing(html: string, limit: number): Promise<SearchResult[]> {
//   const cheerio = await import('cheerio');
//   const $ = cheerio.load(html);
//   const out: SearchResult[] = [];
//   $('.b_algo').each((_, el) => {
//     if (out.length >= limit) return false;
//     const link = $(el).find('h2 a[href^="http"], h2 a[href^="https"]');
//     if (!link.length) return;
//     let href = cleanBingUrl(link.attr('href')!);
//     if (!href.startsWith('http')) return;
//     const title = ensureTitle(link.text(), href);
//     const raw = $(el).find('.b_caption p').text();
//     const snippet = ensureSnippet(raw, href, title);
//     out.push({ title, url: href, snippet, source: 'bing' });
//   });
//   return out;
// }
// async function parseBingFallback(html: string, limit: number): Promise<SearchResult[]> {
//   const cheerio = await import('cheerio');
//   const $ = cheerio.load(html);
//   const out: SearchResult[] = [];
//   $('#b_results li').each((_, el) => {
//     if (out.length >= limit) return false;
//     const link = $(el).find('a[href^="http"], a[href^="https"]').first();
//     if (!link.length) return;
//     let href = cleanBingUrl(link.attr('href')!);
//     if (!href.startsWith('http')) return;
//     const title = ensureTitle(link.text(), href);
//     const raw = $(el).find('p').text();
//     const snippet = ensureSnippet(raw, href, title);
//     out.push({ title, url: href, snippet, source: 'bing' });
//   });
//   return out;
// }
// // a very lenient generic parser – last‑ditch when Bing experiments strip IDs/classes
// async function parseBingGeneric(html: string, limit: number): Promise<SearchResult[]> {
//   const cheerio = await import('cheerio');
//   const $ = cheerio.load(html);
//   const seen = new Set<string>();
//   const out: SearchResult[] = [];
//   $('#b_content a[href^="http"], #b_content a[href^="https"]').each((_, a) => {
//     if (out.length >= limit) return false;
//     const link = $(a);
//     let href = cleanBingUrl(link.attr('href')!);
//     if (!href.startsWith('http') || seen.has(href)) return;
//     const title = ensureTitle(link.text(), href);
//     if (title.length < 5) return;
//     // Try to grab following sibling paragraph as snippet
//     const raw = $(a).closest('li,div').find('p').first().text();
//     const snippet = ensureSnippet(raw, href, title);
//     seen.add(href);
//     out.push({ title, url: href, snippet, source: 'bing' });
//   });
//   return out;
// }
// function cleanBingUrl(href: string) {
//   if (href.includes('GLinkRedirect') && href.includes('url=')) return decodeURIComponent(href.split('url=')[1]);
//   const m = href.match(/[&?]url=([^&]+)/);
//   if (m) {
//     try {
//       const dec = decodeURIComponent(m[1]);
//       if (dec.startsWith('http')) return dec;
//     } catch {}
//   }
//   return href;
// }

// // 4. Ranking / dedup ----------------------------------------------------------
// // --------------------------------------------------
// function score(r: SearchResult, c: number) {
//   let s = Math.min(r.snippet.length / 10, 50) + c * 20 + Math.max(0, 100 - r.title.length);
//   const d = r.url.toLowerCase();
//   if (d.includes('wikipedia')) s += 30;
//   if (d.includes('stackoverflow')) s += 25;
//   if (d.includes('github')) s += 20;
//   if (d.endsWith('.edu') || d.endsWith('.gov')) s += 15;
//   if (r.source === 'startpage') s += 8;
//   return s;
// }
// function dedup(arr: SearchResult[]): SearchResult[] {
//   const map = new Map<string, SearchResult[]>();
//   arr.forEach((r) => {
//     const key = (() => {
//       try {
//         const u = new URL(r.url);
//         return u.origin + u.pathname;
//       } catch {
//         return r.url;
//       }
//     })();
//     (map.get(key) ?? map.set(key, []).get(key)!).push(r);
//   });
//   return Array.from(map.values())
//     .map((g) => g.reduce((a, b) => (score(a, g.length) > score(b, g.length) ? a : b)))
//     .sort((a, b) => score(b, 1) - score(a, 1));
// }

// // --------------------------------------------------
// // 5. Orchestrator -------------------------------------------------------------
// // --------------------------------------------------
// export async function performWebSearch(params: SearchParams): Promise<SearchResponse> {
//   const start = Date.now();
//   const { query, limit, clientIp = '' } = SearchParamsSchema.parse(params);

//   const [dRes, sRes, bRes] = await Promise.all([
//     ddg(query, limit, clientIp),
//     sleep(500).then(() => startpage(query, limit, clientIp)),
//     sleep(1000).then(() => bing(query, limit, clientIp)),
//   ]);

//   console.log(`Merged counts – DDG:${dRes.length} | SP:${sRes.length} | Bing:${bRes.length}`);

//   const all = [...dRes, ...sRes, ...bRes];
//   if (!all.length) throw new Error('No search results');
//   const ranked = dedup(all).slice(0, limit);
//   return {
//     results: ranked,
//     totalResults: ranked.length,
//     searchTime: Date.now() - start,
//     sources: [dRes.length && 'duckduckgo', sRes.length && 'startpage', bRes.length && 'bing'].filter(
//       Boolean,
//     ) as string[],
//   };
// }
