import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { API_PLANS } from "@convex/lib/apiPlans";

vi.mock("server-only", () => ({}));
const authenticate = vi.fn();
const fetchMutation = vi.fn();
const fetchAction = vi.fn();
const countCall = vi.fn();
vi.mock("../auth", () => ({ authenticate: (...a: unknown[]) => authenticate(...a) }));
vi.mock("convex/nextjs", () => ({
  fetchMutation: (...a: unknown[]) => fetchMutation(...a),
  fetchAction: (...a: unknown[]) => fetchAction(...a),
}));
vi.mock("../usage", () => ({
  takeMinute: () => ({ ok: true, remaining: 29, reset: 30 }),
  checkAllowance: async () => ({ ok: true, today: 1, month: 1 }),
  countCall: (...a: unknown[]) => countCall(...a),
}));

const { addWatch, createWebhook, deleteWebhook, listWebhooks, removeWatch } = await import("../webhooksApi");

const caller = {
  kind: "key" as const,
  keyId: "KEY00001",
  keyHash: "a".repeat(64),
  account: "acct_a",
  plan: API_PLANS.plus,
  accountPlan: "free" as const,
  paywall: false,
  scopes: ["read", "webhooks"],
  sandbox: false,
  expiresAt: null,
};
const post = (body: unknown) =>
  new Request("https://permtracker.app/v1/webhooks", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

beforeEach(() => {
  vi.stubEnv("API_SERVER_SECRET", "server-secret-for-tests");
  authenticate.mockReset().mockResolvedValue({ ok: true, caller });
  fetchMutation.mockReset();
  fetchAction.mockReset();
  countCall.mockReset();
});

afterEach(() => vi.unstubAllEnvs());

describe("the webhook doors", () => {
  it("lists the account's endpoints and watches by the key's hash, and counts the call", async () => {
    fetchMutation.mockResolvedValue({ ok: true, endpoints: [], watches: [] });
    const res = await listWebhooks(new Request("https://permtracker.app/v1/webhooks"));
    expect(res.status).toBe(200);
    expect(fetchMutation.mock.calls[0]![1]).toEqual({ keyHash: caller.keyHash, serverSecret: "server-secret-for-tests" });
    expect(countCall).toHaveBeenCalledTimes(1);
  });

  it("says the door is shut when the server's secret isn't set, and asks Convex nothing", async () => {
    vi.stubEnv("API_SERVER_SECRET", "");
    const res = await listWebhooks(new Request("https://permtracker.app/v1/webhooks"));
    expect(res.status).toBe(503);
    expect(fetchMutation).not.toHaveBeenCalled();
  });

  it("answers 400, not 500, to a watch name that isn't valid percent-encoding", async () => {
    const res = await removeWatch(new Request("https://permtracker.app/v1/watches/x", { method: "DELETE" }), "%E0%A4%A");
    expect(res.status).toBe(400);
    expect(fetchMutation).not.toHaveBeenCalled();
  });

  it("refuses a key without the webhooks scope before asking Convex", async () => {
    authenticate.mockResolvedValue({ ok: true, caller: { ...caller, scopes: ["read"] } });
    const res = await listWebhooks(new Request("https://permtracker.app/v1/webhooks"));
    expect(res.status).toBe(403);
    expect(fetchMutation).not.toHaveBeenCalled();
  });

  it("refuses a sandbox key", async () => {
    authenticate.mockResolvedValue({ ok: true, caller: { ...caller, sandbox: true } });
    const res = await listWebhooks(new Request("https://permtracker.app/v1/webhooks"));
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("sandbox_key");
  });

  it("returns a new endpoint's secret once, with a 201", async () => {
    fetchAction.mockResolvedValue({ ok: true, id: "jd7abc", secret: "whsec_x" });
    const res = await createWebhook(post({ url: "https://example.com/h", events: ["queue.moved"] }));
    expect(res.status).toBe(201);
    expect((await res.json()).data).toMatchObject({ id: "jd7abc", secret: "whsec_x" });
  });

  it("refuses a malformed body before checking the key, and counts nothing", async () => {
    expect((await createWebhook(post("not json"))).status).toBe(400);
    expect((await createWebhook(post({ url: "https://example.com/h" }))).status).toBe(400);
    expect((await createWebhook(post("x".repeat(5000)))).status).toBe(400);
    expect(authenticate).not.toHaveBeenCalled();
    expect(countCall).not.toHaveBeenCalled();
  });

  it("passes on the plan's refusal as a 403 and counts nothing", async () => {
    fetchAction.mockResolvedValue({ ok: false, message: "The Plus plan has 5 webhook endpoints. Delete one to add another." });
    const res = await createWebhook(post({ url: "https://example.com/h", events: ["queue.moved"] }));
    expect(res.status).toBe(403);
    expect(countCall).not.toHaveBeenCalled();
  });

  it("wants exactly one of a case number and an employer to watch", async () => {
    const req = (b: unknown) => new Request("https://permtracker.app/v1/watches", { method: "POST", body: JSON.stringify(b) });
    expect((await addWatch(req({}))).status).toBe(400);
    expect((await addWatch(req({ caseNumber: "G-100-26045-123456", employer: "x" }))).status).toBe(400);
    fetchAction.mockResolvedValue({ ok: true, id: "w1", already: false });
    expect((await addWatch(req({ caseNumber: "G-100-26045-123456" }))).status).toBe(201);
    expect(fetchAction.mock.calls[0]![1]).toMatchObject({ kind: "case", target: "G-100-26045-123456" });
  });

  it("refuses an id that can't be an endpoint's", async () => {
    expect((await deleteWebhook(new Request("https://permtracker.app/v1/webhooks/x", { method: "DELETE" }), "../x")).status).toBe(400);
  });
});
