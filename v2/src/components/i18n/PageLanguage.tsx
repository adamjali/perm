"use client";

import { useEffect } from "react";

/**
 * The document's language while a translated page is shown (WCAG 2.1 3.1.1).
 *
 * The root layout declares `<html lang="en">` for every page, so a Korean page
 * reported itself as English (Ahrefs flagged the five, Oct 2026). Its content
 * block already carries its own `lang`, so a screen reader reads the text
 * right; this makes the page's own language match once it loads, and hands the
 * old value back when the reader moves on. Declaring it in the server HTML
 * would take a second root layout for these pages. Google reads a page's
 * language from its text and ignores this attribute.
 */
export function PageLanguage({ tag }: { tag: string }) {
  useEffect(() => {
    const html = document.documentElement;
    const before = html.lang;
    html.lang = tag;
    return () => {
      html.lang = before;
    };
  }, [tag]);
  return null;
}
