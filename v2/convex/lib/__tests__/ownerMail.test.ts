/**
 * Mail to the owner goes through the free mail Worker when it's set up, and
 * through Resend whenever it isn't or doesn't answer (Oct 12 2026).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Resend } from "resend";
import { sendOwnerMail, textFromHtml, workerCanSend } from "../ownerMail";
import { WORKER_TIMEOUT_MS } from "../ownerWorker";
import { sendOrQueue } from "../email";

const OWNER = "owner@example.com";

function fakeCtx() {
  return { runQuery: vi.fn(async () => 0), runMutation: vi.fn(async () => null) } as never;
}
function fakeResend() {
  const send = vi.fn(async () => ({ data: { id: "r1" }, error: null }));
  return { resend: { emails: { send } } as unknown as Resend, send };
}
const msg = { to: OWNER, subject: "Disk", html: "<p>Disk <b>full</b></p>" };

beforeEach(() => {
  vi.stubEnv("SECURITY_ALERT_EMAIL", OWNER);
  vi.stubEnv("OWNER_MAIL_URL", "https://mail.example.com/owner");
  vi.stubEnv("OWNER_MAIL_KEY", "key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("sendOwnerMail", () => {
  it("uses the Worker for the owner, with the key and a text copy, and never Resend", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { resend, send } = fakeResend();
    const out = await sendOwnerMail(fakeCtx(), "alert", resend, msg);
    expect(out.data?.id).toBe("worker");
    expect(send).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-owner-mail-key"]).toBe("key");
    expect(JSON.parse(String(init.body))).toMatchObject({ subject: "Disk", text: "Disk full" });
  });

  it("falls back to Resend when the Worker refuses or can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 502 })));
    const a = fakeResend();
    expect((await sendOwnerMail(fakeCtx(), "alert", a.resend, msg)).error).toBeUndefined();
    expect(a.send).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    const b = fakeResend();
    await sendOwnerMail(fakeCtx(), "alert", b.resend, msg);
    expect(b.send).toHaveBeenCalledTimes(1);
  });

  it("waits for a Worker that sends but answers slowly, so the owner gets one copy", async () => {
    vi.useFakeTimers();
    try {
      // A Worker that answers after `ms`, and gives up when the caller stops waiting.
      const slow = (ms: number) =>
        vi.fn(
          (_url: string, init: RequestInit) =>
            new Promise<Response>((resolve, reject) => {
              const t = setTimeout(() => resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })), ms);
              init.signal?.addEventListener("abort", () => {
                clearTimeout(t);
                reject(new DOMException("aborted", "AbortError"));
              });
            }),
        );
      // Oct 28 2026: delivered, then answered after more than 10 seconds.
      vi.stubGlobal("fetch", slow(15_000));
      const a = fakeResend();
      const late = sendOwnerMail(fakeCtx(), "alert", a.resend, msg);
      await vi.advanceTimersByTimeAsync(15_000);
      expect((await late).data?.id).toBe("worker");
      expect(a.send).not.toHaveBeenCalled();
      // A Worker that never answers still hands the message to Resend.
      vi.stubGlobal("fetch", slow(WORKER_TIMEOUT_MS + 60_000));
      const b = fakeResend();
      const stuck = sendOwnerMail(fakeCtx(), "alert", b.resend, msg);
      await vi.advanceTimersByTimeAsync(WORKER_TIMEOUT_MS + 1);
      await stuck;
      expect(b.send).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses Resend for anyone but the owner, and when the Worker isn't configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const a = fakeResend();
    await sendOwnerMail(fakeCtx(), "alert", a.resend, { ...msg, to: "someone@example.com" });
    expect(a.send).toHaveBeenCalledTimes(1);
    vi.stubEnv("OWNER_MAIL_KEY", "");
    const b = fakeResend();
    await sendOwnerMail(fakeCtx(), "alert", b.resend, msg);
    expect(b.send).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("pieces", () => {
  it("workerCanSend ignores case and spaces in the owner address", () => {
    expect(workerCanSend(" Owner@Example.com ")).toBe(true);
  });
  it("textFromHtml keeps the words and drops the markup", () => {
    expect(textFromHtml("<style>p{}</style><p>One &amp; two</p><br/><div>Three</div>")).toBe("One & two\n\nThree");
  });

  it("textFromHtml decodes each entity once, so an escaped entity stays as written", () => {
    expect(textFromHtml("<p>Write &amp;lt;b&amp;gt; for bold</p>")).toBe("Write &lt;b&gt; for bold");
  });

  it("textFromHtml drops a script whose closing tag has a space, and a tag split by another", () => {
    expect(textFromHtml("<p>Hi</p><script>alert(1)</script ><p>there</p>")).toBe("Hi\nthere");
    expect(textFromHtml("<scr<b>ipt>x")).toBe("x");
  });
});

describe("any email to one of the owner's inboxes (Oct 12 2026)", () => {
  const ok = () => vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

  it("goes through the Worker whatever sent it, a reply-to carried along", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);
    const { resend, send } = fakeResend();
    const out = await sendOrQueue(fakeCtx(), "weekly-summary", resend, {
      from: "x@permtracker.app",
      to: "Owner@Example.com",
      replyTo: "person@example.org",
      subject: "Your week",
      html: "<p>Hi</p>",
    });
    expect(out.data?.id).toBe("worker");
    expect(send).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ to: "owner@example.com", replyTo: "person@example.org", text: "Hi" });
  });

  it("reaches a second inbox once it's listed in OWNER_INBOXES, and not before", async () => {
    vi.stubGlobal("fetch", ok());
    expect(workerCanSend("second@example.org")).toBe(false);
    vi.stubEnv("OWNER_INBOXES", "second@example.org, third@example.net");
    expect(workerCanSend("Second@Example.org")).toBe(true);
    const { resend, send } = fakeResend();
    const out = await sendOrQueue(fakeCtx(), "alert", resend, { from: "x@permtracker.app", to: "second@example.org", subject: "s", text: "t" });
    expect(out.data?.id).toBe("worker");
    expect(send).not.toHaveBeenCalled();
  });

  it("leaves mail to anyone else, or to several people, on Resend", async () => {
    const fetchMock = ok();
    vi.stubGlobal("fetch", fetchMock);
    const a = fakeResend();
    await sendOrQueue(fakeCtx(), "alert", a.resend, { from: "x@permtracker.app", to: "someone@example.com", subject: "s", html: "<p>h</p>" });
    const b = fakeResend();
    await sendOrQueue(fakeCtx(), "alert", b.resend, { from: "x@permtracker.app", to: [OWNER, "someone@example.com"], subject: "s", html: "<p>h</p>" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(a.send).toHaveBeenCalledTimes(1);
    expect(b.send).toHaveBeenCalledTimes(1);
  });
});

