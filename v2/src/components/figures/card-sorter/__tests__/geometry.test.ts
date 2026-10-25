/**
 * The sorter's moving parts: stacks as tall as the cards in them, and kickers that reach the card
 * they push and stop at the front rail.
 */
import { describe, expect, it } from "vitest";

import { CARD_HALF_D, KICK_MAX, KICK_REST, POCKETS, RAIL_FRONT_Y, TRACK_Y, buildSorter, kickReach, stackHeight } from "../geometry";

describe("a pocket's stack", () => {
  it("is nothing for no cards, one card's thickness for one, and full height for the fullest pocket", () => {
    expect(stackHeight(0, 91)).toBe(0);
    expect(stackHeight(1, 91)).toBeCloseTo(0.4, 6);
    expect(stackHeight(91, 91)).toBeCloseTo(13, 6);
  });

  it("grows with every card", () => {
    for (let n = 1; n < 91; n++) expect(stackHeight(n + 1, 91)).toBeGreaterThan(stackHeight(n, 91));
  });

  it("draws an empty pocket's floor bare", () => {
    const art = buildSorter();
    expect(art.stack(3, 0, 91)).toBe("");
    expect(art.stack(0, 91, 91)).not.toBe("");
  });
});

describe("a pocket's kicker", () => {
  it("rests clear of a card on the track and touches its back edge", () => {
    expect(kickReach(TRACK_Y)).toBeGreaterThanOrEqual(KICK_REST);
    expect(kickReach(TRACK_Y) - KICK_REST).toBeLessThan(2);
  });

  it("reaches no farther than the front rail, where the card leaves the rails", () => {
    expect(kickReach(RAIL_FRONT_Y + CARD_HALF_D)).toBeCloseTo(KICK_MAX, 6);
    expect(kickReach(100)).toBe(KICK_MAX);
    expect(kickReach(-100)).toBe(KICK_REST);
  });

  it("is drawn for every pocket", () => {
    const art = buildSorter();
    for (let i = 0; i < POCKETS; i++) expect(art.kicker(i, KICK_MAX)).toMatch(/<path/);
  });
});
