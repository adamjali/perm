import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ALERT_TEXT } from "@/components/alerts/alerts.messages";
import { FORMS_TEXT } from "@/components/alerts/forms.messages";
import { LangProvider } from "@/components/i18n/LangProvider";
import { LANGS, type Lang } from "@/lib/i18n/lang";

import { AlertsPage, alertsPageMetadata } from "../AlertsPage";
import { ALERTS_PAGE } from "../alertsPage.messages";

/**
 * The alerts page in every language it's published in (Oct 29 2026). Each language's page carries its own words
 * all the way through: the headings, every form's labels and buttons, and the links. A link to a page that is only
 * in English says so with hreflang, and the case box sends a reader to the case page in their own language.
 */

function renderPage(lang: Lang) {
  return render(
    <LangProvider lang={lang}>
      <AlertsPage lang={lang} />
    </LangProvider>,
  );
}

/** The English form sentences a translated page must not show (long enough to be prose, not a code like EB-2). */
const englishFormWords = [
  FORMS_TEXT.en.queue.heading,
  FORMS_TEXT.en.queue.whatPerm,
  FORMS_TEXT.en.queue.whatPwd,
  FORMS_TEXT.en.queue.button,
  FORMS_TEXT.en.queue.whichQueue,
  FORMS_TEXT.en.bulletin.heading,
  FORMS_TEXT.en.bulletin.what,
  FORMS_TEXT.en.bulletin.button,
  FORMS_TEXT.en.bulletin.country,
  ALERT_TEXT.en.note,
  ALERT_TEXT.en.otherEmails,
  ALERT_TEXT.en.digest.button,
  ALERTS_PAGE.en.h1,
  ALERTS_PAGE.en.intro,
];

describe("the alerts page in each language", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONVEX_URL", "https://example-123.convex.cloud");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(LANGS)("%s has its own heading and one section per kind of alert", (lang) => {
    renderPage(lang);
    const t = ALERTS_PAGE[lang];
    expect(screen.getByRole("heading", { level: 1, name: t.h1 })).toBeInTheDocument();
    for (const id of ["case", "month", "wage", "bulletin", "employer", "digest"] as const) {
      expect(screen.getByRole("heading", { level: 2, name: t.kinds[id].title }), `${lang} ${id}`).toBeInTheDocument();
    }
  });

  it.each(LANGS.filter((l) => l !== "en"))("%s shows none of the English form copy", (lang) => {
    const { container } = renderPage(lang);
    const text = container.textContent ?? "";
    // The forms really rendered, in this language.
    expect(text).toContain(FORMS_TEXT[lang].queue.button);
    expect(text).toContain(FORMS_TEXT[lang].queue.whichQueue);
    expect(text).toContain(FORMS_TEXT[lang].bulletin.what);
    expect(text).toContain(ALERT_TEXT[lang].digest.button);
    for (const english of englishFormWords) expect(text, `${lang}: ${english}`).not.toContain(english);
  });

  it("marks links to pages that are only in English, and only on a translated page", () => {
    const es = renderPage("es").container;
    expect(es.querySelector('a[href="/perm-employers"]')?.getAttribute("hreflang")).toBe("en");
    // The preferences page is translated too, so its link stays in Spanish.
    const prefs = es.querySelector('a[href="/es/email-preferences"]');
    expect(prefs).not.toBeNull();
    expect(prefs?.hasAttribute("hreflang")).toBe(false);

    const en = renderPage("en").container;
    expect(en.querySelector('a[href="/perm-employers"]')?.hasAttribute("hreflang")).toBe(false);
    expect(en.querySelector('a[href="/email-preferences"]')).not.toBeNull();
  });

  it("ends a Chinese sentence with Chinese punctuation", () => {
    const text = renderPage("zh").container.textContent ?? "";
    expect(text).not.toMatch(/[\u4e00-\u9fff）]\.(\s|$)/);
  });

  it("sends the case box to the case page in the reader's language", () => {
    const { container } = renderPage("ko");
    const form = container.querySelector('form[action*="perm-case-status"]');
    expect(form?.getAttribute("action")).toBe("/ko/perm-case-status#watch");
  });

  it("names every language's page in the head, with its own address", () => {
    const meta = alertsPageMetadata("pt-br");
    expect(meta.alternates?.canonical).toBe("/pt-br/perm-case-alerts");
    const languages = meta.alternates?.languages as Record<string, string>;
    expect(Object.values(languages)).toEqual(
      expect.arrayContaining(["/perm-case-alerts", "/es/perm-case-alerts", "/zh/perm-case-alerts", "/pt-br/perm-case-alerts", "/ko/perm-case-alerts", "/vi/perm-case-alerts"]),
    );
    expect(alertsPageMetadata("en").alternates?.canonical).toBe("/perm-case-alerts");
  });
});
