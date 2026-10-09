import { describe, expect, it } from "vitest";

import {
  API_KEY_LENGTH,
  API_KEY_PREFIX,
  apiKeyChecksum,
  buildApiKey,
  displayKeyId,
  hashApiKey,
  parseApiKey,
  randomBase62,
  SANDBOX_KEY_PREFIX,
} from "./apiKeyFormat";

const realRandom = (n: number) => crypto.getRandomValues(new Uint8Array(n));

describe("API key format", () => {
  it("builds keys that parse, with the documented length and prefix", () => {
    for (let i = 0; i < 50; i++) {
      const key = buildApiKey(realRandom);
      expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
      expect(key).toHaveLength(API_KEY_LENGTH);
      expect(API_KEY_LENGTH).toBe(46);
      const parsed = parseApiKey(key);
      expect(parsed?.keyId).toBe(key.slice(API_KEY_PREFIX.length, API_KEY_PREFIX.length + 8));
    }
  });

  it("refuses a key with one character changed, by its checksum", () => {
    const key = buildApiKey(realRandom);
    const i = API_KEY_PREFIX.length + 5;
    const swapped = key.slice(0, i) + (key[i] === "a" ? "b" : "a") + key.slice(i + 1);
    expect(parseApiKey(swapped)).toBeNull();
  });

  it.each([
    ["empty", ""],
    ["wrong prefix", `pt_test_${"a".repeat(32)}${apiKeyChecksum("a".repeat(32))}`],
    ["too short", "pt_live_abc"],
    ["a symbol in the body", `pt_live_${"a".repeat(31)}-${apiKeyChecksum(`${"a".repeat(31)}-`)}`],
    ["trailing space", `${buildApiKey(realRandom)} `],
  ])("refuses %s", (_label, text) => {
    expect(parseApiKey(text)).toBeNull();
  });

  it("uses every base-62 character and nothing else", () => {
    // A counter as the random source walks every byte value, so a bias or a
    // missing character in the mapping would show.
    let n = 0;
    const counter = (len: number) => Uint8Array.from({ length: len }, () => n++ % 256);
    const text = randomBase62(4000, counter);
    expect(new Set(text).size).toBe(62);
    expect(/^[0-9A-Za-z]+$/.test(text)).toBe(true);
  });

  it("skips bytes of 248 and over so no character is favoured", () => {
    const high = (len: number) => new Uint8Array(len).fill(250);
    let calls = 0;
    const mixed = (len: number) => (calls++ === 0 ? high(len) : Uint8Array.from({ length: len }, () => 3));
    expect(randomBase62(4, mixed)).toBe("3333");
  });

  it("hashes with SHA-256, lowercase hex", async () => {
    expect(await hashApiKey("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("shows a key by its prefix and id only", () => {
    expect(displayKeyId("Ab3kXy9Q")).toBe("pt_live_Ab3kXy9Q…");
    expect(displayKeyId("Ab3kXy9Q", true)).toBe("pt_test_Ab3kXy9Q…");
  });
});

describe("sandbox keys", () => {
  it("build with pt_test_, parse as sandbox, and keep the live key's length", () => {
    const key = buildApiKey(realRandom, true);
    expect(key.startsWith(SANDBOX_KEY_PREFIX)).toBe(true);
    expect(key).toHaveLength(API_KEY_LENGTH);
    expect(parseApiKey(key)).toMatchObject({ sandbox: true, keyId: key.slice(8, 16) });
    expect(parseApiKey(buildApiKey(realRandom))).toMatchObject({ sandbox: false });
  });

  it("checksum the prefix too, so a live key can't be turned into a sandbox one by its prefix", () => {
    const live = buildApiKey(realRandom);
    expect(parseApiKey(`pt_test_${live.slice(8)}`)).toBeNull();
    const test = buildApiKey(realRandom, true);
    expect(parseApiKey(`pt_live_${test.slice(8)}`)).toBeNull();
  });
});
