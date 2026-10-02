import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { webpSize } from "../../../../test-utils/image-size";
import { TOUR_SHOTS } from "../tourShots";

describe("the attorney page's product pictures", () => {
  const shots = Object.entries(TOUR_SHOTS).flatMap(([surface, set]) =>
    Object.entries(set).map(([key, shot]) => ({ name: `${surface}.${key}`, ...shot })),
  );

  it("covers every surface in both themes", () => {
    expect(shots.length).toBeGreaterThanOrEqual(16);
    for (const set of Object.values(TOUR_SHOTS)) {
      expect(set.light).toBeDefined();
      expect(set.dark).toBeDefined();
    }
  });

  it("declares each picture at the size of its file", () => {
    for (const s of shots) {
      const file = join(process.cwd(), "public", s.src);
      expect(existsSync(file), `${s.name}: ${s.src} is missing`).toBe(true);
      expect(webpSize(file), s.name).toEqual({ w: s.width, h: s.height });
    }
  });
});
