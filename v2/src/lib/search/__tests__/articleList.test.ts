import { afterEach, describe, expect, it, vi } from "vitest";

import { loadArticles, resetArticleList } from "../articleList";

const list = [{ title: "How the PERM queue works", href: "/guides/how-the-perm-queue-works", kind: "guides" }];

afterEach(() => {
  resetArticleList();
  vi.unstubAllGlobals();
});

describe("the shared article list", () => {
  it("is fetched once however many parts ask for it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(list)));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([loadArticles(), loadArticles()]);
    expect(await loadArticles()).toEqual(list);
    expect(a).toEqual(list);
    expect(b).toEqual(list);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/articles.json");
  });

  it("forgets a failed fetch, so the next ask tries again", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(list)));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadArticles()).rejects.toThrow("503");
    expect(await loadArticles()).toEqual(list);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses an answer that isn't a list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "x" }))));
    await expect(loadArticles()).rejects.toThrow("not a list");
  });
});
