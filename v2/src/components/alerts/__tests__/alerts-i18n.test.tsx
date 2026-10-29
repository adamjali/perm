import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaseAlertForm } from "@/components/tools/CaseAlertForm";
import { LANGS } from "@/lib/i18n/lang";

import { connectionThrottleReply, siteThrottleReply } from "../../../../convex/lib/throttleReply";

import {
  ALERT_TEXT,
  BAD_EMAIL_REPLY,
  BAD_NUMBER_REPLY,
  MONTH_REPLY,
  NEUTRAL_REPLY,
  PREFS_REPLY,
  QUEUED_LINK_REPLY,
  PUSH_DAY_REPLY,
  PUSH_HOUR_REPLY,
  QUEUED_REPLY,
  serverReply,
} from "../alerts.messages";

/**
 * The alert boxes on a translated case page speak the page's language, server replies included (Oct 29 2026: a
 * waiting case's Spanish page showed the whole email box in English). A reply is translated only when it is one
 * of the server's fixed sentences, which are the same for every address, so translating says nothing about who
 * is signed up.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const flat = (s: string) => s.replace(/"\s*\+\s*"/g, "").replace(/\s+/g, " ");

describe("the alert boxes' translations", () => {
  it("quote the server's fixed replies exactly, so each one matches", () => {
    const server = flat(read("convex/caseAlerts.ts") + read("convex/confirmationQueue.ts") + read("convex/casePushAlerts.ts"));
    for (const reply of [NEUTRAL_REPLY, BAD_EMAIL_REPLY, BAD_NUMBER_REPLY, QUEUED_REPLY, PUSH_HOUR_REPLY, PUSH_DAY_REPLY]) {
      expect(server, reply).toContain(reply);
    }
    // The month, bulletin and digest boxes answer with the same fixed sentences, and the month box with one more.
    for (const file of ["convex/queueAlerts.ts", "convex/bulletinAlerts.ts", "convex/digestSignup.ts"]) {
      const src = flat(read(file));
      expect(src, file).toContain(NEUTRAL_REPLY);
      expect(src, file).toContain(BAD_EMAIL_REPLY);
    }
    expect(flat(read("convex/queueAlerts.ts"))).toContain(MONTH_REPLY);
    // The preferences link answers with its own two.
    expect(flat(read("convex/emailPrefs.ts"))).toContain(PREFS_REPLY);
    expect(flat(read("convex/confirmationQueue.ts"))).toContain(QUEUED_LINK_REPLY);
  });

  it("translate every fixed reply in every language but English", () => {
    for (const lang of LANGS) {
      if (lang === "en") continue;
      for (const reply of [NEUTRAL_REPLY, BAD_EMAIL_REPLY, BAD_NUMBER_REPLY, MONTH_REPLY, PREFS_REPLY, QUEUED_LINK_REPLY, QUEUED_REPLY, PUSH_HOUR_REPLY, PUSH_DAY_REPLY]) {
        const out = serverReply(lang, reply);
        expect(out, `${lang}: ${reply}`).not.toBe(reply);
        expect(out.length, `${lang}: ${reply}`).toBeGreaterThan(5);
      }
      // Anything else passes through as the server wrote it.
      expect(serverReply(lang, "Try again in 3 minutes.")).toBe("Try again in 3 minutes.");
    }
    expect(serverReply("en", NEUTRAL_REPLY)).toBe(NEUTRAL_REPLY);
  });

  it("translate the two try-again replies with their wait, read from the server's own wording", () => {
    const waits = [{ ms: 30_000, n: null }, { ms: 40 * 60_000, n: "40" }, { ms: 3 * 3_600_000, n: "3" }];
    for (const lang of LANGS) {
      if (lang === "en") {
        expect(serverReply(lang, connectionThrottleReply(60_000))).toBe(connectionThrottleReply(60_000));
        continue;
      }
      for (const { ms, n } of waits) {
        for (const english of [connectionThrottleReply(ms), siteThrottleReply(ms)]) {
          const out = serverReply(lang, english);
          expect(out, `${lang}: ${english}`).not.toBe(english);
          if (n) expect(out, `${lang}: ${english}`).toContain(n);
          expect(out, `${lang}: ${english}`).not.toMatch(/Try again|minutes|hours/);
        }
      }
      // Another site-wide limit's wording (firm claims, preference links) stays as the server wrote it.
      const other = siteThrottleReply(60_000, "preference links");
      expect(serverReply(lang, other)).toBe(other);
    }
  });

  it("say on a translated page that the emails are in English, and say nothing of it in English", () => {
    expect(ALERT_TEXT.en.emailLanguage).toBe("");
    for (const lang of LANGS) if (lang !== "en") expect(ALERT_TEXT[lang].emailLanguage.length, lang).toBeGreaterThan(5);
  });
});

describe("the email alert form in Spanish", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example-123.convex.cloud");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true, message: NEUTRAL_REPLY }), { status: 200 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("shows its own words in Spanish and the server's reply translated", async () => {
    render(<CaseAlertForm caseNumber="G-100-26138-922311" lang="es" />);
    expect(screen.getByLabelText(ALERT_TEXT.es.label("perm"))).toBeTruthy();
    expect(screen.getByRole("button", { name: ALERT_TEXT.es.button })).toBeTruthy();
    expect(screen.queryByText(/Email me/)).toBeNull();
    fireEvent.change(screen.getByLabelText(ALERT_TEXT.es.label("perm")), { target: { value: "a@example.com" } });
    fireEvent.submit(screen.getByRole("button", { name: ALERT_TEXT.es.button }).closest("form")!);
    await waitFor(() => expect(screen.getByText(ALERT_TEXT.es.replies[NEUTRAL_REPLY]!)).toBeTruthy());
    expect(screen.queryByText(NEUTRAL_REPLY)).toBeNull();
  });

  it("stays as it was in English", () => {
    render(<CaseAlertForm caseNumber="G-100-26138-922311" />);
    expect(screen.getByLabelText("Email me when DOL changes this PERM case's status")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Email me changes" })).toBeTruthy();
  });
});
