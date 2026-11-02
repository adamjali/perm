import { describe, expect, it } from "vitest";

import { buildSocDescription, placeDescription } from "../socProfile";

describe("buildSocDescription", () => {
  it("writes the description, a blank line, then one task a line", () => {
    expect(buildSocDescription("Develop software.", ["Analyze needs.", " Modify code. "])).toBe(
      "Develop software.\n\n- Analyze needs.\n- Modify code.",
    );
  });

  it("leaves out what's missing, never an empty line", () => {
    expect(buildSocDescription(null, ["Analyze needs."])).toBe("- Analyze needs.");
    expect(buildSocDescription("Develop software.", [])).toBe("Develop software.");
    expect(buildSocDescription("", [" ", ""])).toBe("");
  });
});

describe("placeDescription", () => {
  it("fills an empty description whichever way is asked", () => {
    expect(placeDescription("  ", "New.", "append")).toBe("New.");
    expect(placeDescription("", "New.", "replace")).toBe("New.");
  });

  it("adds after the words already there, or replaces them", () => {
    expect(placeDescription("Mine.\n", "New.", "append")).toBe("Mine.\n\nNew.");
    expect(placeDescription("Mine.", "New.", "replace")).toBe("New.");
  });
});
