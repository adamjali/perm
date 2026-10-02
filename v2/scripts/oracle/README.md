# The self-hosted server (Oracle Cloud, Always Free)

Everything that runs on the server is in this directory, copied from the
machine itself. Change it here first, then install it there.

## What runs, and how it connects

```
visitor ─▶ Cloudflare (DNS, TLS, firewall rules, edge cache for build files)
             │  Cloudflare Tunnel: the server dials OUT, no web port is open
             ▼
         cloudflared ─▶ nginx 127.0.0.1:8081 ─▶ live slot, two copies (one per CPU):
                          (per-page limits,       "blue" 127.0.0.1:3001 + 3011, or
                           real client IP,        "green" 127.0.0.1:3002 + 3012
                           analytics relay)       │   (the other slot is the rollback)
                                                     ▼
                                           libsql-server 127.0.0.1:8080 (the database)
GitHub Actions ─(tunnel host, signed token)─▶ libsql-server   (ingest jobs)
GitHub Actions ─(ssh, deploy key)─▶ permtracker-deploy       (new releases)
```

| piece | unit / file | notes |
|---|---|---|
| database | `permtracker-db.service` | libsql-server 0.24.33 (official image build of 2026-08-23), JWT logins: `"a":"ro"` reads, `"a":"rw"` writes |
| database in RAM | `permtracker-dbcache.service` | `vmtouch -l` locks the file in memory: reads from RAM, and used memory stays above Oracle's idle line (measured 11% at rest, 37% locked; the rule reclaims an A1 instance whose p95 CPU, network AND memory are all under 20% for 7 days). Capped at 6 GB |
| website | `permtracker-web@blue`, `@green`, `@blue2`, `@green2` | Next.js standalone build. Node builds a page on one CPU, so the live slot runs TWO copies, `@<slot>` and `@<slot>2`, the second from its own copy of the release (`<release>.w2`); nginx splits pages between them by a hash of the URL (`hash "$uri?$pt_args_no_rsc" consistent`, so a page and its click data land on the same copy and its cache). The other slot is the instant rollback. Added Oct 2 2026 after a scraper filled the one copy's 64 in-flight slots four times in an hour |
| front door | `nginx/permtracker.conf` | loopback only; the rate limits Vercel's firewall used to enforce (nothing under `/_next/` counts, as on Vercel); verified crawlers exempt via the `x-pt-verified-bot` header Cloudflare sets, and the site's own audit scripts via `x-permtracker-audit` matching the key in `/etc/nginx/permtracker-audit-key.conf` (root, 600; never in this repo) |
| edge cache | Cloudflare Cache Rule "PERM Tracker edge cache" + nginx `$pt_cdn_cc` | Cloudflare keeps copies only of pages the site marks shareable (`s-maxage`); nginx hands it `Cloudflare-CDN-Cache-Control: max-age=600, stale-while-revalidate=3600`, so a refreshed page shows at the edge within ~10 min and visitors never wait on a refresh. Never `/api`, `/ingest`, or anyone with a `__convexAuth` cookie. Sep 28 from Florida: cached pages 0.11-0.17 s vs Vercel's 0.20-0.29 s; live lookups, API and signed-in requests measured uncached |
| control panel | Cockpit 360 (`cockpit-ws`, `cockpit-system`, `cockpit-bridge` only, no network manager) | listens on `127.0.0.1:9090` only (`cockpit.socket` drop-in); the owner opens it from a Mac with the `PERM Tracker Server.command` launcher, an SSH tunnel to port 19090. Signs in as the owner's admin account (sudo group). To reach it from anywhere later: enable Cloudflare Access on the account, then route a hostname to `http://127.0.0.1:9090` behind an Access policy. The tunnel drops when the Mac sleeps or changes network; running the launcher again reopens it. Metrics history: PCP 7.1.1 (installed from Cockpit Sep 29 2026), `pmcd` on localhost:44321 only and `pmlogger` once a minute, 14 days kept, low priority via `systemd/dropins/resources-pcp.conf`; `pmproxy` (network export) and `pmie` (alert rules) disabled. Don't install realmd: it joins Active Directory domains, which this server has none of |
| the way in | `systemd/cloudflared.service` | remotely managed Cloudflare Tunnel `permtracker-oracle`; runs as its own `cloudflared` user; token in `/etc/cloudflared/token` (root:cloudflared 440). Its routes (the apex, www and db; staging was removed Sep 28 2026) are set in Cloudflare, not here |
| deploys | `bin/permtracker-deploy` | the only command the deploy key can run: `deploy <id>`, `rollback`, `status` |
| crons | `permtracker-cron@*.timer` | the ten crons Vercel used to run (off since Sep 28 2026), same UTC times, calling the same routes with `CRON_SECRET`; `src/app/api/cron/dispatch/__tests__/route.test.ts` holds each timer to `jobs.ts` |
| USCIS fetches | `permtracker-uscis@*.timer` | the three USCIS jobs the Mac ran until Sep 28 2026, same Eastern times (`www.uscis.gov` answers this server), plus `h1b-hub` (USCIS's H-1B Employer Data Hub, the 20th of each month) and `sevp` (ICE's top-200 OPT and CPT employer lists, the 22nd), both added Oct 1 2026 |
| health | `permtracker-health.timer` | every 10 minutes: memory, CPU, disk, backup age, service states, the live copy, and the people shown a refusal page (below) into `perm_docs['server_health']`, with 7 days of samples in `/srv/permtracker/health/` for Oracle's idle rule. The morning report's "server" section judges it |
| is it big enough | `/__pt/busy-seen` in `nginx/permtracker.conf`, `/var/log/permtracker-busy/seen.log`, `conf/logrotate-permtracker-busy` | both refusal pages carry a 1-pixel image that only a browser drawing the page asks for, so its log counts PEOPLE shown "busy for a moment" (the server was full) or "one moment" (their own address asked too fast), not the scripts turned away. Crawler and headless user agents are left out. The health check counts a person as one address plus browser, per day for 7 days; the morning report prints the week and warns at 10 people shown "busy" in a day, or 3 or more on 3 days running: that's the time to add CPUs. The folder is `root:permtracker 750`, so the health check reads it without the `adm` group. Added Oct 2 2026 |
| watchdog | `permtracker-watchdog.timer` | every 2 minutes; restarts a piece that runs but stops answering (see below) |
| backups | `permtracker-backup.timer` | 3:15 AM Eastern: full SQL dump, zstd, checked to end in COMMIT, newest 7 kept, `backups/LAST_OK` |
| sealed server copy | `permtracker-backup-server.timer` | 3:35 AM Eastern, as root: the env files, secrets, the database signing key, tunnel token, R2 key, nginx, SSH, fail2ban and the installed scripts and units, sealed with the backup key's public half (CMS, AES-256-GCM) and copied to R2 `server/`; refuses to write a copy missing any of them; `backups/SERVER_OK` |
| sealed Convex copy | `convex-backup.yml`, dispatched by `permtracker-cron@dispatch-convex-backup` (3:50 AM Eastern) | GitHub exports Convex (accounts, cases, subscriptions), seals it on the runner and hands only the sealed file to `permtracker-deploy convex-backup`, which keeps 7 and copies it to R2 `convex/`; `backups/CONVEX_OK` |
| page-cache cap | `permtracker-prune.timer` | every 30 minutes (:05, :35): pages Next rendered after a deploy are removed least recently used first above 20 GB for the live copy, 4 GB for the standby and 0 for older releases (8 / 0 / 0 below 20 GB free); a removed page is simply rendered again; `health/prune.json` |

## What repairs itself, and what cannot grow

| failure | what happens | proven |
|---|---|---|
| a process exits or is killed | systemd restarts it: `permtracker-db`, both web copies and `cloudflared` always, nginx on failure (drop-ins in `systemd/dropins/`), and none of them ever stops retrying (`StartLimitIntervalSec=0`) | nginx, tunnel and database each killed with `kill -9` on Sep 28: back in seconds, site 200 throughout |
| a process runs but stops answering | `permtracker-watchdog.timer` (every 2 min) checks the database, both web copies, nginx and the tunnel's `/ready`; after 3 failed checks in a row it restarts that piece, at most once per 30 min, and logs it to `health/repairs.log` | a web copy frozen with `SIGSTOP`: restarted on the third check, answering 200 |
| the machine reboots | every unit is enabled and comes back (measured: 30 s) | Sep 28 |
| security fixes | unattended-upgrades (Ubuntu security, plus `pkg.cloudflare.com` and `deb.nodesource.com`, see `conf/`); needrestart restarts whatever still runs old code; a reboot at 06:30 UTC only when an update requires one | dry run lists all origins |
| the disk | journald capped at 1 GB and 30 days; nginx logs rotate daily, 14 kept; the refusal-page log daily, 10 kept, 50 MB at most, 6 a minute per address; releases 5 kept, build files 21 days; backups 7 kept; health samples and repairs 7 days; Oracle disk backups 3 days (`permtracker-daily-keep3`, 06:00 UTC, inside the free 5) | |
| the page cache | `permtracker-prune` keeps each release's rendered pages inside its budget (live 60 GB, standby 6 GB since Sep 29 2026; 8 and 0 below 20 GB free) (measured Sep 29 2026: the live release held 13 GB after 7 hours; a full crawl would reach about 69 GB per release) | Sep 29: 12 GB freed on its first run |
| memory and CPU | drop-ins in `systemd/dropins/resources-*.conf`: the database is last in line for the out-of-memory killer (-900) and first for CPU and disk; each web copy is squeezed past 3 GB and restarted past 3.5 GB; the RAM lock is the first thing killed if memory runs out (killing it frees 3.2 GB at once); every job yields CPU and disk and stops at 4 GB; every job has a time limit | Sep 29 |
| traffic | nginx (`nginx/permtracker.conf`, checked by `test_nginx_conf.py` in CI): per address 600 pages a minute, 1,200 background pre-loads, 120 case lookups (pre-loads never count: a pre-load answers the loading shell and never asks DOL), 240 API calls; a person over a rate is SLOWED first (two-stage `delay=`) and only far past it gets a page that reloads itself (429, Retry-After 30; JSON under `/api`). In flight at once: 64 for the app, 32 per address, 24 case lookups from everyone together (so a scraper walking case numbers can't fill the app; added Oct 2 2026), 6 for search engines, 4 for other crawlers (503, Retry-After 15). Crawlers: Google and Bing 180 a minute per family, outside the shared pool; others 90 each and 180 together, except Meta's AI crawler (`meta-externalagent`), 30 a minute since Oct 2 2026 (it had been the biggest load that wasn't a person: a median 73 pages a minute from 110 addresses). Cloudflare in front: a browser check for Tencent Cloud (AS132203; a scraper there filled every app slot on Oct 2 2026, 2:42 to 2:46 AM EDT) and a one-click check for Windows Chrome reporting version 151 or 80 to 139 (the same scraper on residential proxies minutes later; real Windows Chrome on 80 to 139 ran 19 pageviews in 3 days), both skipped by verified crawlers, a flood backstop of 500 requests per 10 s per address, security level low, a passed challenge lasts 30 minutes (Oct 2 2026; it had been a week, which let a headless browser that passed once keep reading). Public images, build files and the root icons (`favicon.ico`, `icon-192.png`, `icon-512.png`, `icon.svg`, `badge-72.png`, `apple-touch-icon.png`, a day cached; added Oct 2 2026, about 1,800 needless app requests in 5 hours before) are served from disk, outside every limit. `sw.js` stays with the app: a service worker's security policy comes from its own response headers. Email links (`/prefs`, `/unsubscribe`, every alert's confirm and unsubscribe) go from nginx straight to the Convex backend with only the headers it needs, marked never-stored and unframeable (Oct 2 2026: they had been relayed through Next, and Cloudflare had been keeping them up to 2 hours). Analytics (`/ingest/`) goes from nginx straight to PostHog, never through the app (Oct 2 2026; it had stacked 11 close listeners per request in Node and flooded the log with MaxListenersExceededWarning) | Sep 29: 40 simultaneous pre-loads from one address all answered where 30 had been refused; 12 real case loads in a row all answered |
| automatic defense | `permtracker-defend.timer` (every minute), `bin/permtracker-defend`, `/etc/permtracker/defend.env` (root, 600: `CF_ZONE_ID`, `ALERT_TO`, and `CF_API_TOKEN` once the owner makes one; Zone WAF and Zone Settings edit on permtracker.app only), the request log `/var/log/permtracker-busy/defend.log` (nginx `pt_defend`, two days kept) | Trouble is people being turned away, not traffic: 2 people drawing the busy page in 10 minutes, or the app full (2% and 20+ page requests answered 503) 3 minutes running. Then it finds the source over 5 minutes of unverified page requests (a network from Cloudflare's `x-pt-asn` header, or one exact browser label, at 30% and 300+; never a whole consumer ISP or our own hosts) and adds ONE custom rule (ref `pt-autodefend`): a managed challenge. Still in trouble 10 minutes later, or no single source: Under Attack Mode (custom rule 2 skips the security level for crawlers, assistants, previews, unsubscribe and sign-in POSTs, revalidation and the database host). Under Attack Mode lasts at most an hour, then steps back to the rule and may not return for three hours (a scraper that passes Cloudflare's checks would otherwise keep every visitor behind it). 30 calm minutes: rule removed, security level restored. Every change is emailed (8 a day at most, from the server's Resend key), written to `health/repairs.log` (the morning email) and kept in `health/defend.json`. Without a token, or with `health/defend.off`, it only watches and logs what it would have done. Added Oct 2 2026, live from 7:09 AM EDT with a token the owner's Cloudflare login made (`permtracker-defend`: Zone WAF Edit and Zone Settings Edit on permtracker.app only); `test_defend.py` |
| the database folder | the engine keeps its own log and snapshots next to the data; `server_health` records both sizes and the morning report warns past 3x the data file | 1.97x on Sep 28 (one snapshot from the import) |

Everything above is reported: the morning email's "server" section reads `perm_docs['server_health']`,
including any repair in the last 24 hours.

## Reloading nginx: a refused reload looks like success

nginx keeps its OLD rules when it refuses a reload, and `systemctl reload nginx` still exits 0; `nginx -t` cannot
catch the commonest cause, a rate-limit zone whose key changed (`limit_req "x" uses the "$a" key while previously
it used the "$b" key` in `/var/log/nginx/error.log`). Measured Sep 29 2026. Rename the zone instead, and count a
reload only when new worker processes appear: `permtracker-deploy` does exactly that before it records a traffic
switch (`reload_nginx`). Install scripts at the path their unit names (`grep ExecStart`): a prune script copied
to `/usr/local/sbin` while the timer ran `/usr/local/bin` would have kept the old budget.

## Deploy, roll back, see the state

Pushing to the deploy branch runs `.github/workflows/oracle-deploy.yml`: build on
`ubuntu-24.04-arm` (prerendering through an ssh tunnel to the database with the
read-only token), then `permtracker-deploy` starts the release on the idle copy,
waits for `/api/health` and `/perm-queue` to answer, and only then points nginx
at it. A failed health check leaves traffic where it was.

A deploy copies the release to `<release>.w2`, starts BOTH copies of the idle slot, checks both, warms them
(the core pages and the 300 busiest employers, two at a time, 4 minutes at most), points nginx at both, then stops
the old slot's second copy. A rollback switches to the other slot's first copy at once, then starts its second copy
and moves traffic onto both. `second` starts a missing second copy for the live slot (used once, Oct 2 2026).
Refresh calls (`/api/revalidate-*`) go to the first copy and nginx mirrors them to the second, because each copy
keeps its own memory of which pages are stale.

```bash
ssh <admin> sudo permtracker-deploy status
ssh <admin> sudo permtracker-deploy rollback     # back to the other slot, instantly
journalctl -u permtracker-web@blue -f            # a copy's log
```

## Secrets (names and places only)

| secret | where |
|---|---|
| website settings (AI keys, Sentry, PostHog, Resend, Turnstile, Calendar...) | `/srv/permtracker/app/env/production.env` (root:permtracker 640), copied from Vercel's production settings |
| database tokens | `/srv/permtracker/secrets/db_ro.jwt`, `db_rw.jwt`; signing key in `/root/permtracker-jwt/` |
| `CRON_SECRET`, `REVALIDATE_SECRET` | `/srv/permtracker/secrets/` (new values; GitHub's `REVALIDATE_SECRET` is updated on switch day) |
| `GITHUB_DISPATCH_TOKEN` | `/srv/permtracker/secrets/github_dispatch_token` |
| deploy key, host, known hosts, read-only DB token for builds | GitHub secrets `ORACLE_*` |
| backup key, PRIVATE half (opens the sealed server and Convex copies) | only the owner's Mac, `~/.config/permtracker-backup/backup-key.pem` (600), plus the owner's own safe copy; never on this server, GitHub or R2. The public half is `conf/backup-recipient.pem` here and `/etc/permtracker/backup-recipient.pem` |

## Restore a backup

```bash
zstd -dc /srv/permtracker/backups/db-<stamp>.sql.zst | sqlite3 /tmp/restore.db
# stop permtracker-db, put restore.db at data.sqld/dbs/default/data
# (remove wallog, to_compact, data-wal, data-shm), start permtracker-db
```

The sealed copies open only with the backup key's private half (on the owner's
Mac). Fetch one from R2 (`server/` or `convex/`, 15 days kept) or from
`/srv/permtracker/backups/`, then:

```bash
K=~/.config/permtracker-backup/backup-key.pem
# the server: secrets and config, as a tar of absolute paths
openssl cms -decrypt -binary -inform DER -in server-<stamp>.tar.zst.cms -inkey $K | zstd -dc | tar -tvf -
# Convex: the export zip, then import it (read the prompt; --replace overwrites)
openssl cms -decrypt -binary -inform DER -in convex-<stamp>.zip.cms -inkey $K -out convex.zip
npx convex import --prod --replace convex.zip
```

Layers, newest first: Oracle's own disk backups (3 days, whole machine), the
nightly database dump (7 here, 15 days in R2), the sealed server and Convex
copies (7 here, 15 days in R2), and the weekly public dump of the tables DOL
cannot give back (GitHub artifact, 90 days, `backup-observations.yml`).

## Switch day (only on the owner's go)

1. Pause the GitHub ingest dispatches (Vercel's crons) and wait for running jobs.
2. Final copy from Turso (`bin/run-import.sh`), row counts compared table by table.
3. GitHub secrets `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` point at the database
   host with the read-write token; `REVALIDATE_SECRET` gets the server's value.
4. **Convex reads the database itself** (alert sweeps, the digest, employer follows: `convex/lib/publicMirror.ts`).
   Set Convex prod `TURSO_DATABASE_URL=https://db.permtracker.app` and `TURSO_AUTH_TOKEN` to the server's
   read-only token, moved from `secrets/db_ro.jwt` by pipe, never printed. Convex only ever reads.
5. `permtracker.app` and `www` DNS records become proxied CNAMEs to the tunnel (add both to the tunnel's routes),
   and both hostnames join `http.host in {...}` in the edge-cache rule.
   On the server: `SENTRY_ENVIRONMENT=production`. In the repo: `oracle-deploy.yml` triggers on `main`, and
   Vercel's Git connection is removed so a push deploys once.
6. Enable the timers here; remove Vercel's crons; move the Mac's launchd jobs.
7. The privacy policy and terms on this branch already name Oracle and Cloudflare in place of
   Vercel and BotID; set both pages' "Last Updated" to the switch date in the same deploy.
   **The one deploy merges three branches**: `build/sep28-fixes`, `fix/email-postal-address`
   and this one. **Ship the site before `npx convex deploy`**: that batch makes a new password
   account need a one-time pass from a passed Turnstile check (`convex/lib/turnstilePass.ts`).
   A new page against the old backend gets no pass and sends none, which the old backend
   doesn't check; the old page against the new backend would be refused. Then sign up once
   with a fresh address to prove it.
   **The human check moves to the adamjali Cloudflare account in the same deploy.** Its new
   widget "PERM Tracker auth forms" (site key `0x4AAAAAAFHoEQvCKKVd2AJu`, hostname
   `permtracker.app`, which covers every subdomain) was made Sep 28; the secret sits in
   `~/.config/permtracker/turnstile_secret_adamjali` (600) on the Mac and passed a siteverify
   probe. Set the GitHub variable `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the new key before the
   build, and right after the site is live run
   `npx convex env set TURNSTILE_SECRET_KEY "$(cat ~/.config/permtracker/turnstile_secret_adamjali)" --prod`
   and then `npx convex deploy -y`. Between those two a login or sign-up can fail once and work
   on retry (about 3 form submits a day, so a two-minute gap is a small chance of one retry).
   A week later delete the old "PERM Tracker Signup" widget in the personal Cloudflare account.
8. **After every settings change, run `check_settings.py`** (`ssh permtracker 'sudo /usr/bin/python3 -' <
   v2/scripts/oracle/check_settings.py`) and expect all PASS. It scans every env file for copy artifacts
   and asks each service whether it accepts its key. Set values with `printf %s` or `tr -d '\n'`, never
   `echo`: on Sep 28 nine values copied from Vercel carried a stray `\n` and every AI key was rejected.
   Values set in GitHub or Convex on switch day get the same treatment and a live check afterwards.
9. Check Google sign-in (Convex sends Google back to permtracker.app, so it can
   only be tested on the real domain). Rollback: point the two DNS records back
   to Vercel.
