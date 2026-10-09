#!/usr/bin/env node
/**
 * permtracker: the PERM Tracker API on the command line.
 *
 *   npx permtracker case G-100-26045-123456
 *   npx permtracker estimate --filed 2026-02-15
 *   npx permtracker employer google-llc --json
 *   npx permtracker export cases q=acme state=CA > acme.csv
 *   npx permtracker watch G-100-26045-123456
 *   npx permtracker login            # saves your key for later calls
 *
 * The key comes from --key, then PERMTRACKER_API_KEY, then the file `login`
 * writes (~/.config/permtracker/config.json, readable by you alone). Output is
 * a plain listing, or the API's JSON with --json.
 */
import { realpathSync } from "node:fs";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

import { PermTracker, PermTrackerError, VERSION, WEBHOOK_EVENTS, type Answer, type ExportKind } from "./index.js";

const HELP = `permtracker ${VERSION}: DOL case status, estimates and PERM data from permtracker.app

Usage: permtracker <command> [arguments] [--json] [--key <key>]

  case <number> [--live]   one case: PERM (G-), wage request (P-), LCA (I-), H-2A, H-2B, CW-1;
                           --live asks DOL now when our records don't hold it yet
  estimate <number>        when a pending PERM case is likely to be decided
  estimate --filed <date>  the same for a filing date, YYYY-MM-DD
  queue                    DOL's processing times and the pending queue
  bulletin [YYYY-MM]       a visa bulletin, the newest by default
  employers <name>         search employers      employer <slug>   one employer
  firms <name>             search law firms      firm <slug>       one law firm
  jobs <title>             search occupations    job <slug>        one occupation
  lookup <name>            the employer page a printed name belongs to (no key)
  export <kind> [name=value ...] [--format csv|json] [--out <file>]
                           a whole search: cases (the case search's parameters),
                           employers, law-firms or occupations (q=...); CSV by default
  watch <number>           watch a case for your webhooks; --employer <slug> for an employer;
                           with nothing after it, list what you watch
  unwatch <number>         stop watching; --employer <slug> for an employer
  webhooks                 your webhook endpoints
  webhooks add <url> <event ...>   a new endpoint (its secret is shown once)
  webhooks remove <id>     delete an endpoint
  me                       your key, your plan and what you've used
  login                    save your key        logout   forget it

Webhook events: ${WEBHOOK_EVENTS.join(", ")}.
Make a free key at https://permtracker.app/settings (API keys).
Docs: https://permtracker.app/developers`;

export function configPath(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(base, "permtracker", "config.json");
}

async function savedKey(): Promise<string | undefined> {
  try {
    const c = JSON.parse(await readFile(configPath(), "utf8")) as { apiKey?: string };
    return c.apiKey;
  } catch {
    return undefined;
  }
}

export interface Parsed {
  command: string | undefined;
  args: string[];
  json: boolean;
  key: string | undefined;
  filed: string | undefined;
  live: boolean;
  employer: string | undefined;
  format: string | undefined;
  out: string | undefined;
  help: boolean;
}

const VALUE_FLAGS = ["key", "filed", "employer", "format", "out"] as const;
type ValueFlag = (typeof VALUE_FLAGS)[number];

export function parseArgs(argv: string[]): Parsed {
  const out: Parsed = {
    command: undefined,
    args: [],
    json: false,
    key: undefined,
    filed: undefined,
    live: false,
    employer: undefined,
    format: undefined,
    out: undefined,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const flag = VALUE_FLAGS.find((f) => a === `--${f}` || a.startsWith(`--${f}=`)) as ValueFlag | undefined;
    if (a === "--json") out.json = true;
    else if (a === "--live") out.live = true;
    else if (a === "--help" || a === "-h") out.help = true;
    else if (flag) out[flag] = a === `--${flag}` ? argv[++i] : a.slice(flag.length + 3);
    else if (!out.command) out.command = a;
    else out.args.push(a);
  }
  return out;
}

/** An export's name=value arguments as query parameters. */
export function exportParams(args: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const a of args) {
    const eq = a.indexOf("=");
    if (eq <= 0) {
      throw new PermTrackerError(400, "bad_argument", `"${a}" isn't name=value. Give the search's parameters like q=acme state=CA.`, null, null);
    }
    params[a.slice(0, eq)] = a.slice(eq + 1);
  }
  return params;
}

const EXPORT_KINDS: readonly ExportKind[] = ["cases", "employers", "law-firms", "occupations"];

/** A plain listing of an answer: nested objects indented, arrays one item a line. */
export function render(value: unknown, indent = ""): string {
  if (value === null || value === undefined) return `${indent}none`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${indent}none`;
    return value
      .map((v) => (typeof v === "object" && v !== null ? `${indent}-\n${render(v, indent + "  ")}` : `${indent}- ${String(v)}`))
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) =>
        typeof v === "object" && v !== null && !(Array.isArray(v) && v.length === 0)
          ? `${indent}${k}:\n${render(v, indent + "  ")}`
          : `${indent}${k}: ${v === null || (Array.isArray(v) && v.length === 0) ? "none" : String(v)}`,
      )
      .join("\n");
  }
  return `${indent}${String(value)}`;
}

function print(answer: Answer<unknown>, json: boolean): void {
  if (json) {
    process.stdout.write(JSON.stringify({ data: answer.data, meta: answer.meta }, null, 2) + "\n");
    return;
  }
  process.stdout.write(render(answer.data) + "\n");
  if (answer.meta?.source) process.stdout.write(`\nSource: ${answer.meta.source}${answer.meta.asOf ? ` (as of ${answer.meta.asOf})` : ""}\n`);
  if (answer.meta?.url) process.stdout.write(`${answer.meta.url}\n`);
}

function need(args: string[], what: string): string {
  const v = args.join(" ").trim();
  if (!v) throw new PermTrackerError(400, "missing_argument", `Give ${what}.`, null, null);
  return v;
}

export async function run(argv: string[]): Promise<number> {
  const p = parseArgs(argv);
  if (p.help || !p.command || p.command === "help") {
    process.stdout.write(HELP + "\n");
    return p.command || p.help ? 0 : 1;
  }
  if (p.command === "--version" || p.command === "version") {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }
  if (p.command === "login") {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const key = (p.key ?? (await rl.question("Paste your PERM Tracker API key (pt_live_...): "))).trim();
    rl.close();
    if (!/^pt_(live|test)_[0-9A-Za-z]{38}$/.test(key)) {
      process.stderr.write("That isn't a PERM Tracker key: keys start with pt_live_ (or pt_test_ for the sandbox) and are 46 characters.\n");
      return 1;
    }
    const me = await new PermTracker({ apiKey: key }).me();
    const file = configPath();
    await mkdir(dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, JSON.stringify({ apiKey: key }) + "\n", { mode: 0o600 });
    await chmod(file, 0o600);
    process.stdout.write(`Saved. Key ${me.data.key.id}, ${me.data.plan.name} plan, ${me.data.usage.remainingToday} calls left today.\n`);
    return 0;
  }
  if (p.command === "logout") {
    await rm(configPath(), { force: true });
    process.stdout.write("Forgot the saved key.\n");
    return 0;
  }

  const pt = new PermTracker({ apiKey: p.key ?? process.env.PERMTRACKER_API_KEY ?? (await savedKey()) });
  const a = p.args;
  let answer: Answer<unknown>;
  switch (p.command) {
    case "case": answer = await pt.case(need(a, "a case number"), { live: p.live }); break;
    case "estimate":
      answer = p.filed ? await pt.estimate({ filed: p.filed }) : await pt.estimate({ case: need(a, "a case number, or --filed YYYY-MM-DD") });
      break;
    case "queue": answer = await pt.queue(); break;
    case "bulletin": answer = await pt.visaBulletin(a[0]); break;
    case "employers": answer = await pt.employers(need(a, "a name to search")); break;
    case "employer": answer = await pt.employer(need(a, "an employer's slug (search with employers)")); break;
    case "firms": answer = await pt.lawFirms(need(a, "a name to search")); break;
    case "firm": answer = await pt.lawFirm(need(a, "a law firm's slug (search with firms)")); break;
    case "jobs": answer = await pt.occupations(need(a, "a job title to search")); break;
    case "job": answer = await pt.occupation(need(a, "an occupation's slug (search with jobs)")); break;
    case "lookup": answer = await pt.lookupEmployer(need(a, "an employer's name")); break;
    case "me": answer = await pt.me(); break;
    case "export": return await runExport(pt, p);
    case "watch":
      if (p.employer) answer = await pt.watch({ employer: p.employer });
      else if (a.length > 0) answer = await pt.watch({ caseNumber: need(a, "a case number") });
      else {
        const list = await pt.watches();
        answer = { ...list, data: list.data.watches };
      }
      break;
    case "unwatch":
      answer = p.employer ? await pt.unwatch(p.employer, "employer") : await pt.unwatch(need(a, "a case number, or --employer <slug>"), "case");
      break;
    case "webhooks": {
      const [sub, ...rest] = a;
      if (sub === "add") {
        const [url, ...events] = rest;
        if (!url || events.length === 0) throw new PermTrackerError(400, "missing_argument", `Give an https address and at least one event: ${WEBHOOK_EVENTS.join(", ")}.`, null, null);
        answer = await pt.createWebhook({ url, events });
      } else if (sub === "remove") {
        answer = await pt.deleteWebhook(need(rest, "an endpoint's id (list them with webhooks)"));
      } else if (sub === undefined) {
        const list = await pt.webhooks();
        answer = { ...list, data: list.data.endpoints };
      } else {
        process.stderr.write(`Unknown webhooks command "${sub}": use add or remove, or nothing to list them.\n`);
        return 1;
      }
      break;
    }
    default:
      process.stderr.write(`Unknown command "${p.command}". Run permtracker --help.\n`);
      return 1;
  }
  print(answer, p.json);
  return 0;
}

async function runExport(pt: PermTracker, p: Parsed): Promise<number> {
  const [kind, ...rest] = p.args;
  if (!kind || !(EXPORT_KINDS as readonly string[]).includes(kind)) {
    process.stderr.write(`Name what to export: ${EXPORT_KINDS.join(", ")}.\n`);
    return 1;
  }
  const format = p.format ?? (p.json ? "json" : "csv");
  if (format !== "csv" && format !== "json") {
    process.stderr.write("--format is csv or json.\n");
    return 1;
  }
  const params = exportParams(rest);
  let text: string;
  let rows: number | null;
  let truncated: boolean;
  let cap: number | null;
  if (format === "csv") {
    const c = await pt.exportCsv(kind as ExportKind, params);
    ({ csv: text, rows, truncated, cap } = c);
  } else {
    const j = await pt.export(kind as ExportKind, params);
    text = JSON.stringify({ data: j.data, meta: j.meta }, null, 2) + "\n";
    ({ count: rows, truncated, cap } = j.data);
  }
  if (p.out) {
    await writeFile(p.out, text);
    process.stderr.write(`Wrote ${rows ?? "the"} rows to ${p.out}.\n`);
  } else {
    process.stdout.write(text);
  }
  if (truncated) process.stderr.write(`More matched than your plan's ${cap ?? ""} rows; narrow the search to get the rest.\n`);
  return 0;
}

// Run when executed (npx links the bin, so compare real paths), not when imported by the tests.
function invokedDirectly(): boolean {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}
const invoked = invokedDirectly();
if (invoked) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err: unknown) => {
      if (err instanceof PermTrackerError) {
        process.stderr.write(`${err.message}${err.retryAfter ? ` (try again in ${err.retryAfter} seconds)` : ""}\n`);
        if (err.url) process.stderr.write(`${err.url}\n`);
        process.exit(err.status === 404 ? 3 : 2);
      }
      process.stderr.write(`${(err as Error).message}\n`);
      process.exit(2);
    },
  );
}
