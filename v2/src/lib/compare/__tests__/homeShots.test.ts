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
});
