# The self-hosted server (Oracle Cloud, Always Free)

Everything that runs on the server is in this directory, copied from the
machine itself. Change it here first, then install it there.

## What runs, and how it connects

```
visitor ─▶ Cloudflare (DNS, TLS, firewall rules, edge cache for build files)
             │  Cloudflare Tunnel: the server dials OUT, no web port is open
             ▼
         cloudflared ─▶ nginx 127.0.0.1:8081 ─▶ website copy "blue"  127.0.0.1:3001
                          (per-page limits,    └▶ website copy "green" 127.0.0.1:3002
                           real client IP)          │
                                                     ▼
                                           libsql-server 127.0.0.1:8080 (the database)
GitHub Actions ─(tunnel host, signed token)─▶ libsql-server   (ingest jobs)
GitHub Actions ─(ssh, deploy key)─▶ permtracker-deploy       (new releases)
```

| piece | unit / file | notes |
|---|---|---|
| database | `permtracker-db.service` | libsql-server 0.24.33 (official image build of 2026-08-23), JWT logins: `"a":"ro"` reads, `"a":"rw"` writes |
| database in RAM | `permtracker-dbcache.service` | `vmtouch -l` locks the file in memory: reads from RAM, and used memory stays above Oracle's idle line (measured 11% at rest, 37% locked; the rule reclaims an A1 instance whose p95 CPU, network AND memory are all under 20% for 7 days). Capped at 6 GB |
| website | `permtracker-web@blue`, `@green` | Next.js standalone build, one copy serves, the other is the instant rollback |
| front door | `nginx/permtracker.conf` | loopback only; the rate limits Vercel's firewall used to enforce (nothing under `/_next/` counts, as on Vercel); verified crawlers exempt via the `x-pt-verified-bot` header Cloudflare sets, and the site's own audit scripts via `x-permtracker-audit` matching the key in `/etc/nginx/permtracker-audit-key.conf` (root, 600; never in this repo) |
| edge cache | Cloudflare Cache Rule "PERM Tracker edge cache" + nginx `$pt_cdn_cc` | Cloudflare keeps copies only of pages the site marks shareable (`s-maxage`); nginx hands it `Cloudflare-CDN-Cache-Control: max-age=600, stale-while-revalidate=3600`, so a refreshed page shows at the edge within ~10 min and visitors never wait on a refresh. Never `/api`, `/ingest`, or anyone with a `__convexAuth` cookie. Sep 28 from Florida: cached pages 0.11-0.17 s vs Vercel's 0.20-0.29 s; live lookups, API and signed-in requests measured uncached |
| control panel | Cockpit 360 (`cockpit-ws`, `cockpit-system`, `cockpit-bridge` only, no network manager) | listens on `127.0.0.1:9090` only (`cockpit.socket` drop-in); the owner opens it with the `PERM Tracker Server.command` launcher on his Mac, an SSH tunnel to port 19090. Signs in as the `adam` account (sudo group). To reach it from anywhere later: enable Cloudflare Access on the account, then route a hostname to `http://127.0.0.1:9090` behind an Access policy |
| the way in | `systemd/cloudflared.service` | remotely managed Cloudflare Tunnel `permtracker-oracle`; runs as its own `cloudflared` user; token in `/etc/cloudflared/token` (root:cloudflared 440). Its routes (staging, db; the apex and www on switch day) are set in Cloudflare, not here |
| deploys | `bin/permtracker-deploy` | the only command the deploy key can run: `deploy <id>`, `rollback`, `status` |
| crons | `permtracker-cron@*.timer` | the ten `vercel.json` crons, same UTC times, calling the same routes with `CRON_SECRET` |
| USCIS fetches | `permtracker-uscis@*.timer` | the Mac's three launchd jobs, same Eastern times (`www.uscis.gov` answers this server) |
| health | `permtracker-health.timer` | every 10 minutes: memory, CPU, disk, backup age, service states and the live copy into `perm_docs['server_health']`, with 7 days of samples in `/srv/permtracker/health/` for Oracle's idle rule. The morning report's "server" section judges it |
| watchdog | `permtracker-watchdog.timer` | every 2 minutes; restarts a piece that runs but stops answering (see below) |
| backups | `permtracker-backup.timer` | 3:15 AM Eastern: full SQL dump, zstd, checked to end in COMMIT, newest 7 kept, `backups/LAST_OK` |

## What repairs itself, and what cannot grow

| failure | what happens | proven |
|---|---|---|
| a process exits or is killed | systemd restarts it: `permtracker-db`, both web copies and `cloudflared` always, nginx on failure (drop-ins in `systemd/dropins/`), and none of them ever stops retrying (`StartLimitIntervalSec=0`) | nginx, tunnel and database each killed with `kill -9` on Sep 28: back in seconds, site 200 throughout |
| a process runs but stops answering | `permtracker-watchdog.timer` (every 2 min) checks the database, both web copies, nginx and the tunnel's `/ready`; after 3 failed checks in a row it restarts that piece, at most once per 30 min, and logs it to `health/repairs.log` | a web copy frozen with `SIGSTOP`: restarted on the third check, answering 200 |
| the machine reboots | every unit is enabled and comes back (measured: 30 s) | Sep 28 |
| security fixes | unattended-upgrades (Ubuntu security, plus `pkg.cloudflare.com` and `deb.nodesource.com`, see `conf/`); needrestart restarts whatever still runs old code; a reboot at 06:30 UTC only when an update requires one | dry run lists all origins |
| the disk | journald capped at 1 GB and 30 days; nginx logs rotate daily, 14 kept; releases 5 kept, build files 21 days; backups 7 kept; health samples and repairs 7 days; Oracle disk backups 3 days (`permtracker-daily-keep3`, 06:00 UTC, inside the free 5) | |
| the database folder | the engine keeps its own log and snapshots next to the data; `server_health` records both sizes and the morning report warns past 3x the data file | 1.97x on Sep 28 (one snapshot from the import) |

Everything above is reported: the morning email's "server" section reads `perm_docs['server_health']`,
including any repair in the last 24 hours.

## Deploy, roll back, see the state

Pushing to the deploy branch runs `.github/workflows/oracle-deploy.yml`: build on
`ubuntu-24.04-arm` (prerendering through an ssh tunnel to the database with the
read-only token), then `permtracker-deploy` starts the release on the idle copy,
waits for `/api/health` and `/perm-queue` to answer, and only then points nginx
at it. A failed health check leaves traffic where it was.

```bash
ssh <admin> sudo permtracker-deploy status
ssh <admin> sudo permtracker-deploy rollback     # back to the other copy, instantly
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

## Restore a backup

```bash
zstd -dc /srv/permtracker/backups/db-<stamp>.sql.zst | sqlite3 /tmp/restore.db
# stop permtracker-db, put restore.db at data.sqld/dbs/default/data
# (remove wallog, to_compact, data-wal, data-shm), start permtracker-db
```

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
8. Check Google sign-in (Convex sends Google back to permtracker.app, so it can
   only be tested on the real domain). Rollback: point the two DNS records back
   to Vercel.
