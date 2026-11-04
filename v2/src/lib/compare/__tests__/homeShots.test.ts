import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { webpSize } from "../../../../test-utils/image-size";
import { HOME_SHOTS } from "../homeShots";
import { RIVALS } from "../rivals";

describe("every tracker on /compare has its homepage picture", () => {
  it("has a picture for each rival, and none for a tracker that isn't listed", () => {
    expect(Object.keys(HOME_SHOTS).sort()).toEqual(RIVALS.map((r) => r.slug).sort());
  });

  it.each(Object.entries(HOME_SHOTS))("%s: the file exists at the size it declares, with a description", (_slug, shot) => {
    const file = join(process.cwd(), "public", shot.src);
    expect(existsSync(file)).toBe(true);
    expect(webpSize(file)).toEqual({ w: shot.width, h: shot.height });
    expect(shot.alt.length).toBeGreaterThan(40);
  });

  it.each(Object.entries(HOME_SHOTS))("%s: dated by the day it was taken, never after its marks were read", (slug, shot) => {
    expect(shot.captured).toMatch(/^2\d{3}-\d{2}-\d{2}$/);
    const rival = RIVALS.find((r) => r.slug === slug)!;
    // A picture can be older than its marks (Nov 3 re-read the marks and kept October's pictures); a picture
    // newer than its marks would be a page the marks don't describe.
    expect(shot.captured <= rival.checkedOn, `${slug} ${shot.captured} vs ${rival.checkedOn}`).toBe(true);
  });
});
