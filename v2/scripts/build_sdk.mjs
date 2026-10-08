#!/usr/bin/env node
/**
 * Build the `permtracker` npm package (v2/sdk): ESM JavaScript and type
 * declarations in sdk/dist. Publishing is a separate, owner-approved step:
 * `cd sdk && npm publish` from the persona's npm account.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sdk = join(here, "..", "sdk");
const bin = join(here, "..", "node_modules", ".bin");
rmSync(join(sdk, "dist"), { recursive: true, force: true });
execFileSync(join(bin, "tsc"), ["-p", join(sdk, "tsconfig.json")], { stdio: "inherit" });
const cli = join(sdk, "dist", "cli.js");
const text = readFileSync(cli, "utf8");
if (!text.startsWith("#!")) writeFileSync(cli, "#!/usr/bin/env node\n" + text);
chmodSync(cli, 0o755);
for (const f of ["README.md", "LICENSE"]) if (!existsSync(join(sdk, f))) throw new Error(`sdk/${f} is missing`);
console.log("built sdk/dist");
