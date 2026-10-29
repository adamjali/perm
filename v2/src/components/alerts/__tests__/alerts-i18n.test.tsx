import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaseAlertForm } from "@/components/tools/CaseAlertForm";
import { LANGS } from "@/lib/i18n/lang";

import {
  ALERT_TEXT,
  BAD_EMAIL_REPLY,
  BAD_NUMBER_REPLY,
  NEUTRAL_REPLY,
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
  });

  it("translate every fixed reply in every language but English", () => {
    for (const lang of LANGS) {
      if (lang === "en") continue;
      for (const reply of [NEUTRAL_REPLY, BAD_EMAIL_REPLY, BAD_NUMBER_REPLY, QUEUED_REPLY, PUSH_HOUR_REPLY, PUSH_DAY_REPLY]) {
        const out = serverReply(lang, reply);
        expect(out, `${lang}: ${reply}`).not.toBe(reply);
        expect(out.length, `${lang}: ${reply}`).toBeGreaterThan(5);
      }
      // Anything else passes through as the server wrote it.
      expect(serverReply(lang, "Try again in 3 minutes.")).toBe("Try again in 3 minutes.");
    }
    expect(serverReply("en", NEUTRAL_REPLY)).toBe(NEUTRAL_REPLY);
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
