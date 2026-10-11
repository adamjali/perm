import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * scripts/indexnow.mjs in its changes-only mode. IndexNow's FAQ asks for
 * changed URLs only ("Do not resubmit unchanged URLs"), and every deploy had
 * sent all 311,450 until Oct 11 2026. These hold the file mode to exactly the
 * URLs it was given, nothing for an empty list, and nothing off the site.
 */
const run = promisify(execFile);
const received: string[][] = [];
let endpoint = "";
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    received.push((JSON.parse(body) as { urlList: string[] }).urlList);
    res.writeHead(200).end();
  });
});

beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address();
  endpoint = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}/indexnow`;
});
afterAll(() => server.close());

const listFile = (lines: string[]) => {
  const dir = mkdtempSync(join(tmpdir(), "indexnow-"));
  const f = join(dir, "urls.txt");
  writeFileSync(f, lines.join("\n"));
  return f;
};
const submit = (file: string) =>
  run("node", ["scripts/indexnow.mjs", "--urls", file], { env: { ...process.env, INDEXNOW_ENDPOINT: endpoint } });

describe("IndexNow, changed pages only", () => {
  it("sends exactly the listed pages, paths made full, duplicates once", async () => {
    received.length = 0;
    const { stdout } = await submit(listFile(["/faq", "/perm-cases", "https://permtracker.app/faq", ""]));
    expect(received).toEqual([["https://permtracker.app/faq", "https://permtracker.app/perm-cases"]]);
    expect(stdout).toMatch(/Submitted 2 page URLs/);
  });

  it("sends nothing when nothing changed", async () => {
    received.length = 0;
    const { stdout } = await submit(listFile([]));
    expect(received).toEqual([]);
    expect(stdout).toMatch(/nothing sent/);
  });

  it("refuses a URL that isn't on the site", async () => {
    received.length = 0;
    await expect(submit(listFile(["https://example.com/x"]))).rejects.toThrow();
    expect(received).toEqual([]);
  });
});
