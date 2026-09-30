import { describe, expect, it } from "vitest";
import { assignMarkerLanes, FOLDED_LANE, foldedMarkers, MARKER_LANE_OFFSETS, MIN_MONTH_PX } from "../positioning";

/** Percent of a `months`-month range that `days` covers. */
const pct = (days: number, months: number) => (days / (months * 30.44)) * 100;

describe("assignMarkerLanes", () => {
  it("keeps markers that are far apart on the band", () => {
    expect(assignMarkerLanes([10, 40, 80], 24)).toEqual([0, 0, 0]);
  });

  it("moves a marker that would overlap its neighbour to another lane", () => {
    // Two days apart on a 24-month range: far closer than one 18px footprint.
    const lanes = assignMarkerLanes([50, 50 + pct(2, 24)], 24);
    expect(lanes[0]).toBe(0);
    expect(lanes[1]).not.toBe(0);
  });

  it("returns lanes in the order the positions were given, not sorted", () => {
    const lanes = assignMarkerLanes([50 + pct(2, 24), 50], 24);
    expect(lanes).toEqual([1, 0]);
  });

  it("uses every lane, then folds the rest instead of drawing one square on another", () => {
    const p = [30, 30.1, 30.2, 30.3];
    const lanes = assignMarkerLanes(p, 24);
    expect(new Set(lanes.slice(0, 3)).size).toBe(MARKER_LANE_OFFSETS.length);
    expect(lanes[3]).toBe(FOLDED_LANE);
  });

  it("gives a folded marker to the nearest drawn one", () => {
    // Five dates in six days at 24 months (the row that clashed on a phone).
    const p = [0, 2, 4, 5, 6].map((d) => 40 + pct(d, 24));
    const lanes = assignMarkerLanes(p, 24);
    const hosts = foldedMarkers(p, lanes);
    const folded = lanes.flatMap((l, i) => (l === FOLDED_LANE ? [i] : []));
    expect(folded.length).toBe(2);
    // Every folded marker is carried exactly once, by a drawn marker.
    const carried = [...hosts.values()].flat().sort();
    expect(carried).toEqual(folded);
    for (const host of hosts.keys()) expect(lanes[host]).not.toBe(FOLDED_LANE);
    // Nearest: 6 days folds into the marker at 4, not the one at 0.
    const hostOf6 = [...hosts].find(([, list]) => list.includes(4))?.[0];
    expect(hostOf6).toBe(2);
  });

  it("folds nothing when every marker has a lane", () => {
    expect(foldedMarkers([10, 40], assignMarkerLanes([10, 40], 24)).size).toBe(0);
  });

  it("clears at the narrowest month width: a footprint apart stays on one lane", () => {
    const months = 12;
    const footprintPct = (18 / (months * MIN_MONTH_PX)) * 100;
    expect(assignMarkerLanes([20, 20 + footprintPct + 0.01], months)).toEqual([0, 0]);
    expect(assignMarkerLanes([20, 20 + footprintPct - 0.5], months)).toEqual([0, 1]);
  });
});
