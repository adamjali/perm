import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FILM_ATTORNEYS } from "@/lib/constants/films";

vi.mock("../FilmPlayer", () => ({ FilmPlayer: () => null }));

import { ExplainerFilm } from "../ExplainerFilm";

describe("ExplainerFilm", () => {
  it("keeps the transcript on the page and out of search snippets", () => {
    // A spoken line leans on the one before it; Bing quoted one as the homepage's snippet (Oct 28 2026).
    const { container } = render(<ExplainerFilm film={FILM_ATTORNEYS} />);
    const block = container.querySelector("[data-nosnippet]");
    expect(block).not.toBeNull();
    for (const line of FILM_ATTORNEYS.transcript) expect(block!.textContent).toContain(line);
  });
});
