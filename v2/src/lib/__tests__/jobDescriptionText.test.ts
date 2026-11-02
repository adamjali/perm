import { describe, expect, it } from "vitest";

import { descriptionBlocks } from "../jobDescriptionText";

describe("descriptionBlocks", () => {
  it("reads paragraphs and runs of bullet lines, keeping every word", () => {
    expect(descriptionBlocks("Develop software for clients.\nWork in a team.\n\n- Analyze needs.\n* Write code.\n• Test it.\n\nRequires a degree.")).toEqual([
      { kind: "paragraph", text: "Develop software for clients. Work in a team." },
      { kind: "list", items: ["Analyze needs.", "Write code.", "Test it."] },
      { kind: "paragraph", text: "Requires a degree." },
    ]);
  });

  it("starts a new list after a paragraph, and reads a hyphenated word as a word", () => {
    expect(descriptionBlocks("- One.\nFull-time role.\n- Two.")).toEqual([
      { kind: "list", items: ["One."] },
      { kind: "paragraph", text: "Full-time role." },
      { kind: "list", items: ["Two."] },
    ]);
  });

  it("draws nothing for empty text", () => {
    expect(descriptionBlocks("")).toEqual([]);
    expect(descriptionBlocks(" \n\n ")).toEqual([]);
  });
});
