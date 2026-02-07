"use client";

/**
 * TableOfContents
 *
 * Auto-generated TOC from article headings with scroll-spy.
 * Reads h2/h3 headings from the DOM and highlights the active one.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface TocItem {
  id: string;
  text: string;
  level: number;
}

export default function TableOfContents() {
  const [headings, setHeadings] = React.useState<TocItem[]>([]);
  const [activeId, setActiveId] = React.useState<string>("");

  // Extract headings from DOM
  React.useEffect(() => {
    const article = document.querySelector(".prose-neobrutalist");
    if (!article) return;

    const elements = article.querySelectorAll("h2[id], h3[id]");
    const items: TocItem[] = Array.from(elements).map((el) => ({
      id: el.id,
      text: el.textContent ?? "",
      level: el.tagName === "H2" ? 2 : 3,
    }));
    setHeadings(items);
  }, []);

  // Scroll-spy with IntersectionObserver
  React.useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length < 2) return null;

  return (
    <nav aria-label="Table of contents">
      <p className="mb-3 font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground">
        On this page
      </p>
      <ul className="space-y-1 border-l-2 border-border">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById(heading.id);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.scrollY - 96;
                  window.scrollTo({ top: y, behavior: "smooth" });
                }
              }}
              className={cn(
                "block border-l-2 -ml-[2px] py-1 text-sm transition-colors",
                heading.level === 3 ? "pl-6" : "pl-4",
                activeId === heading.id
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
