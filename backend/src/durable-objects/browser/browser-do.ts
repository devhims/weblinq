import { DurableObject } from 'cloudflare:workers';

import type { Browser } from '@cloudflare/puppeteer';

import { connect, launch } from '@cloudflare/puppeteer';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const HEALTH_CHECK_INTERVAL_MS = 3 * 60 * 1000; // alarm every 3min
const REFRESH_THRESHOLD_MS = 8.5 * 60 * 1000; // proactive refresh at 8min30s - shy of CF 10min hard‑limit
const POLITE_CLEANUP_TIMEOUT_MS = 35_000; // give workers up to 35s to finish

/**
 * BrowserDO  – manages a single Cloudflare remote‑browser session.
 *
 *   ✔ Blue‑green refresh (zero‑downtime)
 *   ✔ Explicit early cleanup: once Manager marks this DO *idle* we reconnect
 *     and close the *old* session so the slot is freed before CF’s 10min reap.
 */
export class BrowserDO extends DurableObject<CloudflareBindings> {
  /* ------------------------------------------------------------------------ */
  /*  State                                                                   */
  /* ------------------------------------------------------------------------ */
  private browser: Browser | null = null; // only during launch
  private sessionId: string | null = null; // current (green) session
  private previousSessionId: string | null = null; // shadow copy for cleanup
  private doId: string | null = null;

  /* ------------------------------------------------------------------------ */
  /*  Constructor                                                             */
  /* ------------------------------------------------------------------------ */
  constructor(ctx: DurableObjectState, env: CloudflareBindings) {
    super(ctx, env);
    console.log('BrowserDO: 🏗️ constructor');

    this.ctx.blockConcurrencyWhile(async () => {
      if ((await ctx.storage.getAlarm()) === null) await this.setNextAlarm();
      this.sessionId = (await ctx.storage.get<string>('sessionId')) ?? null;
    });
  }

  /* ------------------------------------------------------------------------ */
  /*  Helpers                                                                 */
  /* ------------------------------------------------------------------------ */
  private setNextAlarm = () => this.ctx.storage.setAlarm(Date.now() + HEALTH_CHECK_INTERVAL_MS);

  private async notifyManagerOfSessionId(sessionId: string) {
    const doId = this.doId ?? (await this.ctx.storage.get<string>('doId'));
    if (!doId) return;
    const managerId = this.env.BROWSER_MANAGER_DO.idFromName('global');
    const manager = this.env.BROWSER_MANAGER_DO.get(managerId);
    await Promise.race([
      manager.updateBrowserDOs(doId, sessionId, 'idle'),
      new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 5000)),
    ]).catch((err) => console.log('BrowserDO: ⚠️ manager notify failed', err));
  }

  private async createNewBrowserWithRetry(): Promise<string> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`BrowserDO: 🚀 launching browser (attempt ${attempt})`);
        this.browser = await launch(this.env.BROWSER, {
          keep_alive: 10 * 60 * 1000,
        });
        const sid = this.browser.sessionId();
        await this.browser.version();
        await (this.browser as any).disconnect();
        this.browser = null;
        await this.ctx.storage.put('sessionId', sid);
        await this.ctx.storage.put('createdAt', Date.now());
        this.sessionId = sid;

        await this.setNextAlarm();
        return sid;
      } catch (err) {
        lastErr = err;
        console.log(`BrowserDO: 💥 launch fail ${attempt}/3`, err);
        await new Promise((res) => setTimeout(res, attempt * 1000));
      }
    }
    throw new Error(`BrowserDO: failed to launch – ${lastErr}`);
  }

  /* ------------------------------------------------------------------------ */
  /*  Alarm = health‑check + refresh                                          */
  /* ------------------------------------------------------------------------ */
  async alarm() {
    await this.setNextAlarm();
    const [sid, createdAt] = await Promise.all([
      this.ctx.storage.get<string>('sessionId'),
      this.ctx.storage.get<number>('createdAt'),
    ]);
    const ageMs = createdAt ? Date.now() - createdAt : Infinity;

    // quick liveness probe
    let healthy = false;
    if (sid) {
      try {
        const probe = await connect(this.env.BROWSER, sid);
        await probe.version();
        await (probe as any).disconnect();
        healthy = true;
        console.log('BrowserDO: ✅ Browser session healthy');
      } catch {
        /* unhealthy */
        console.log('BrowserDO: ❌ Browser session stale');
      }
    }

    if (!sid || !healthy || ageMs > REFRESH_THRESHOLD_MS) {
      console.log('BrowserDO: 🔒 Closing session due to age/staleness');
      await this.closeAndNotify();
    }
  }

  /* ------------------------------------------------------------------------ */
  /*  Session closure + manager notification                                  */
  /* ------------------------------------------------------------------------ */
  private async closeAndNotify() {
    const doId = this.doId ?? (await this.ctx.storage.get<string>('doId'));

    if (!doId) {
      console.log('BrowserDO: ⚠️ No DO ID available for notification');
      return;
    }

    try {
      // Notify manager immediately to mark DO as closed (available for reuse)
      const managerId = this.env.BROWSER_MANAGER_DO.idFromName('global');
      const manager = this.env.BROWSER_MANAGER_DO.get(managerId);
      await manager.updateDOStatus(doId, 'closed', 'Session closed due to age limit');
      console.log('BrowserDO: 📤 Notified manager to close DO:', doId);

      // Schedule polite cleanup in background - don't block the alarm
      const currentSessionId = (await this.ctx.storage.get<string>('sessionId')) ?? null;
      if (currentSessionId) {
        this.ctx.waitUntil(this.politeCleanupWhenIdle(currentSessionId, doId));
      }
    } catch (err) {
      console.log('BrowserDO: ❌ Failed to notify manager of session closure:', err);
    }
  }

  /**
   * Wait until Manager marks us *idle* (no Worker attached) OR we timeout,
   * then reconnect to the *old* session and close it to free the slot early.
   */
  private async politeCleanupWhenIdle(oldSid: string, doId: string) {
    const managerId = this.env.BROWSER_MANAGER_DO.idFromName('global');
    const manager = this.env.BROWSER_MANAGER_DO.get(managerId);
    const start = Date.now();

    // doId is now required parameter, so we can use it directly
    while (Date.now() - start < POLITE_CLEANUP_TIMEOUT_MS) {
      try {
        const status: 'idle' | 'busy' | 'error' | 'closed' | 'unknown' = await manager.getDoStatus(doId);
        console.log('BrowserDO Polite Cleanup: 🔍', status, doId);
        if (status === 'idle' || status === 'closed' || status === 'error') break;
      } catch {
        /* ignore */
      }
      await new Promise((res) => setTimeout(res, 5_000)); // poll every 5s
    }

    try {
      const tmp = await connect(this.env.BROWSER, oldSid);
      await tmp.close();
      console.log('BrowserDO: 🪦 old session closed (polite)');
    } catch {
      /* session already gone – fine */
      console.log('BrowserDO: 🪦 old session stale and gone');
    }
  }

  /* ------------------------------------------------------------------------ */
  /*  RPCs for Browser‑ManagerDO                                              */
  /* ------------------------------------------------------------------------ */
  async setDoId(id: string) {
    this.doId = id;
    await this.ctx.storage.put('doId', id);
  }

  async generateSessionId(expectedId: string): Promise<string | null> {
    await this.setDoId(expectedId);
    // if (this.sessionId) return this.sessionId; // reuse if still valid
    try {
      const newSessionId = await this.createNewBrowserWithRetry();
      // Don't notify manager here - the caller (manager) will handle it
      return newSessionId;
    } catch (err) {
      console.log('BrowserDO: ❌ generateSessionId failed', err);
      return null;
    }
  }

  async cleanup(_expectedId: string) {
    // try to close *current* session if we own it
    const sid = await this.ctx.storage.get<string>('sessionId');
    if (sid) {
      try {
        const tmp = await connect(this.env.BROWSER, sid);
        await tmp.close();
      } catch {
        /* ignore */
      }
    }
    await this.ctx.storage.delete('sessionId');
    await this.ctx.storage.delete('createdAt');
    await this.ctx.storage.deleteAlarm();
    return { success: true, message: 'BrowserDO cleaned' };
  }

  async fetch() {
    return new Response('BrowserDO is RPC‑only', { status: 400 });
  }
}
