import { describe, expect, it } from "vitest";

import { GLOSSARY } from "@/lib/glossary";
import { GLOSSARY_STAGES } from "@/lib/glossaryStages";

describe("the glossary's map", () => {
  it("places every term exactly once, and names no term that doesn't exist", () => {
    const placed = GLOSSARY_STAGES.flatMap((s) => s.slugs);
    const slugs = GLOSSARY.map((t) => t.slug);
    expect(placed.length).toBe(new Set(placed).size);
    expect([...placed].sort()).toEqual([...slugs].sort());
  });

  it("keeps the six stops of the road in order, ahead of the groups beside it", () => {
    const onRoad = GLOSSARY_STAGES.filter((s) => s.onRoad).map((s) => s.id);
    expect(onRoad).toEqual(["wage", "recruitment", "perm", "i140", "bulletin", "greencard"]);
    const firstBeside = GLOSSARY_STAGES.findIndex((s) => !s.onRoad);
    expect(GLOSSARY_STAGES.slice(firstBeside).every((s) => !s.onRoad)).toBe(true);
  });
});
