import { useEffect, useState } from "react";

import type { ArticleRef } from "./didYouMean";

let pending: Promise<ArticleRef[]> | null = null;

/**
 * The article list from /articles.json, fetched at most once per visit and
 * shared by everything that needs it (the search palette, the 404 page). A
 * failed fetch is forgotten, so the next caller tries again.
 */
export function loadArticles(): Promise<ArticleRef[]> {
  pending ??= fetch("/articles.json")
    .then((r) => {
      if (!r.ok) throw new Error(`articles.json answered ${r.status}`);
      return r.json();
    })
    .then((list: unknown) => {
      if (!Array.isArray(list)) throw new Error("articles.json is not a list");
      return list as ArticleRef[];
    })
    .catch((e: unknown) => {
      pending = null;
      throw e;
    });
  return pending;
}

/** The article list once `enabled`; `failed` when it couldn't be read. */
export function useArticles(enabled: boolean): { articles: ArticleRef[]; failed: boolean } {
  const [state, setState] = useState<{ articles: ArticleRef[]; failed: boolean }>({ articles: [], failed: false });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    loadArticles().then(
      (articles) => live && setState({ articles, failed: false }),
      () => live && setState((s) => ({ articles: s.articles, failed: true })),
    );
    return () => {
      live = false;
    };
  }, [enabled]);
  return state;
}

/** For tests: forget the fetched list. */
export function resetArticleList(): void {
  pending = null;
}
