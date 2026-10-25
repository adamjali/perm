/**
 * The mail Worker's email handler (workers/mail/worker.mjs) forwards every
 * message unless Convex's verdict is a clear hold: a slow, missing or failing
 * check, a failing AI and a message too big to read first all forward, so the
 * spam check can never keep a person's mail out of the inbox.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error: a plain ES module the Worker bundles; no type declarations.
import worker from '../../../workers/mail/worker.mjs';

const RAW = [
  'From: Seller <outreach@growthlinks.example>',
  'To: support@permtracker.app',
  'Subject: Guest posts',
  'Message-ID: <m1@growthlinks.example>',
  'Content-Type: text/plain',
  '',
  'We sell backlinks. WhatsApp us.',
  '',
].join('\r\n');

function message(size?: number) {
  const bytes = new TextEncoder().encode(RAW);
  const forwards: string[] = [];
  return {
    to: 'support@permtracker.app',
    from: 'outreach@growthlinks.example',
    headers: new Headers({ subject: 'Guest posts' }),
    rawSize: size ?? bytes.length,
    raw: new Response(bytes).body,
    forward: async (to: string) => {
      forwards.push(to);
    },
    forwards,
  };
}

const env = (ai?: unknown) => ({
  OWNER_EMAIL: 'owner@example.com',
  CONVEX_SITE: 'https://convex.example',
  KEYS: { get: async (k: string) => (k === 'inbound_key' ? 'inkey' : 'ownkey') },
  AI: ai,
});

const aiSpam = { run: async () => ({ response: { verdict: 'spam' } }) };
const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status });

async function deliver(
  verdictReply: () => Response | Promise<Response>,
  opts: { ai?: unknown; size?: number } = { ai: aiSpam },
) {
  const ai = 'ai' in opts ? opts.ai : aiSpam;
  const size = opts.size;
  const stored: Array<Record<string, unknown>> = [];
  const asked: Array<Record<string, unknown>> = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    if (url.endsWith('/inbound-email/verdict')) {
      asked.push(JSON.parse(String(init.body)));
      return verdictReply();
    }
    if (url.endsWith('/inbound-email')) {
      stored.push(JSON.parse(String(init.body)));
      return new Response('{}', { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  const m = message(size);
  const waits: Promise<unknown>[] = [];
  await worker.email(m, env(ai), { waitUntil: (p: Promise<unknown>) => waits.push(p) });
  await Promise.all(waits);
  return { forwards: m.forwards, asked, stored };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('the mail Worker', () => {
  it('holds a message only on a clear hold, and stores it as held', async () => {
    const r = await deliver(json({ ok: true, action: 'hold', score: 6, reasons: ['sells links or SEO'] }));
    expect(r.forwards).toEqual([]);
    expect(r.asked[0]).toMatchObject({ from: 'outreach@growthlinks.example', ai: 'spam' });
    expect(r.stored[0]).toMatchObject({ held: true, forwarded: false, spamScore: 6, spamReasons: ['sells links or SEO'] });
  });

  it.each([
    ['Convex says forward', json({ ok: true, action: 'forward', score: 0, reasons: [] })],
    ['the verdict route is missing', json({ ok: false }, 404)],
    ['Convex throws', () => Promise.reject(new Error('down'))],
  ])('forwards when %s', async (_label, reply) => {
    const r = await deliver(reply);
    expect(r.forwards).toEqual(['owner@example.com']);
    expect(r.stored[0]).toMatchObject({ held: false, forwarded: true });
  });

  it('forwards when the AI fails or is absent, and still asks Convex', async () => {
    const failing = { run: async () => Promise.reject(new Error('5028: model deprecated')) };
    for (const ai of [failing, undefined]) {
      const r = await deliver(json({ ok: true, action: 'forward' }), { ai });
      expect(r.forwards).toEqual(['owner@example.com']);
      expect(r.asked).toHaveLength(1);
      expect(r.asked[0]!.ai).toBeUndefined();
    }
  });

  it('forwards a message too big to read first, unchecked', async () => {
    const r = await deliver(json({ ok: true, action: 'hold' }), { ai: aiSpam, size: 400_000 });
    expect(r.forwards).toEqual(['owner@example.com']);
    expect(r.asked).toHaveLength(0);
    expect(r.stored[0]).toMatchObject({ text: expect.stringContaining('backlinks') });
  });

  it('forwards when Convex never answers', async () => {
    vi.useFakeTimers();
    const pending = deliver(() => new Promise<Response>(() => {}));
    await vi.advanceTimersByTimeAsync(10_000);
    const r = await pending;
    expect(r.forwards).toEqual(['owner@example.com']);
  });
});
