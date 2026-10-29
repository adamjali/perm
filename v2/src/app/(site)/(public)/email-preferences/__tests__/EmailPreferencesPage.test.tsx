import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PREFS_REPLY } from "@/components/alerts/alerts.messages";
import { LangProvider } from "@/components/i18n/LangProvider";
import { PREFS_FORM } from "@/components/prefs/prefsForm.messages";
import { LANGS, type Lang } from "@/lib/i18n/lang";
import { MAIL_KINDS, MAIL_RULES } from "@/lib/mailKinds";

import { EmailPreferencesPage, emailPreferencesMetadata } from "../EmailPreferencesPage";
import { PREFS_PAGE } from "../emailPrefs.messages";

/**
 * The email preferences page in every language (Oct 29 2026). English reads the shared list of emails, so the
 * page can't drift from Settings; each other language names every kind in its own words, keeps links to pages
 * that exist in its language, marks the rest as English, and translates the server's one neutral reply.
 */

function renderPage(lang: Lang) {
  return render(
    <LangProvider lang={lang}>
      <EmailPreferencesPage lang={lang} />
    </LangProvider>,
  );
}

describe("the email preferences page in each language", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example-123.convex.cloud"));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("reads English from the shared list of emails", () => {
    renderPage("en");
    for (const kind of Object.values(MAIL_KINDS)) {
      expect(screen.getByRole("heading", { level: 4, name: kind.name })).toBeInTheDocument();
    }
    for (const rule of MAIL_RULES) expect(screen.getByText(rule.title)).toBeInTheDocument();
  });

  it.each(LANGS.filter((l) => l !== "en"))("%s names every kind in its own words, with none of the English", (lang) => {
    const { container } = renderPage(lang);
    const t = PREFS_PAGE[lang];
    expect(screen.getByRole("heading", { level: 1, name: t.h1 })).toBeInTheDocument();
    const text = container.textContent ?? "";
    for (const [id, kind] of Object.entries(t.kinds)) {
      expect(screen.getByRole("heading", { level: 4, name: kind.name }), `${lang} ${id}`).toBeInTheDocument();
      const english = MAIL_KINDS[id as keyof typeof MAIL_KINDS];
      expect(text, `${lang} ${id}`).not.toContain(english.what);
    }
    expect(text).toContain(PREFS_FORM[lang].label);
    expect(text).not.toContain(PREFS_FORM.en.after);
    expect(text).not.toContain(PREFS_PAGE.en.caption);
    // The emails and the page the link opens are English, and the page says so.
    expect(text).toContain(t.emailLanguage);
  });

  it("keeps a link in the reader's language where the page exists, and marks the rest English", () => {
    const { container } = renderPage("es");
    const digest = container.querySelector('a[href="/es/perm-case-alerts#digest"]');
    expect(digest).not.toBeNull();
    expect(digest?.hasAttribute("hreflang")).toBe(false);
    expect(container.querySelector('a[href="/es/perm-case-status"]')).not.toBeNull();
    for (const href of ["/perm-employers", "/perm-processing-times", "/settings?tab=notifications"]) {
      const links = container.querySelectorAll(`a[href="${href}"]`);
      expect(links.length, href).toBeGreaterThan(0);
      for (const a of links) expect(a.getAttribute("hreflang"), href).toBe("en");
    }
  });

  it("answers in the reader's language with the server's own neutral reply", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true, message: PREFS_REPLY }), { status: 200 })),
    );
    renderPage("pt-br");
    fireEvent.change(screen.getByLabelText(PREFS_FORM["pt-br"].label), { target: { value: "a@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: PREFS_FORM["pt-br"].button }));
    await waitFor(() => expect(screen.getByText("Se enviamos algo para esse endereço, um link de preferências está a caminho.")).toBeInTheDocument());
    expect(screen.queryByText(PREFS_REPLY)).toBeNull();
  });

  it("names every language's page in the head", () => {
    const meta = emailPreferencesMetadata("zh");
    expect(meta.alternates?.canonical).toBe("/zh/email-preferences");
    const languages = Object.values(meta.alternates?.languages as Record<string, string>);
    for (const path of ["/email-preferences", "/es/email-preferences", "/vi/email-preferences"]) expect(languages).toContain(path);
    expect(emailPreferencesMetadata("en").alternates?.canonical).toBe("/email-preferences");
  });
});
