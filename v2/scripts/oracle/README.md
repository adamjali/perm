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
| front door | `nginx/permtracker.conf` | loopback only; the rate limits Vercel's firewall used to enforce; verified crawlers exempt via the `x-pt-verified-bot` header Cloudflare sets |
| deploys | `bin/permtracker-deploy` | the only command the deploy key can run: `deploy <id>`, `rollback`, `status` |
| crons | `permtracker-cron@*.timer` | the ten `vercel.json` crons, same UTC times, calling the same routes with `CRON_SECRET` |
| USCIS fetches | `permtracker-uscis@*.timer` | the Mac's three launchd jobs, same Eastern times (`www.uscis.gov` answers this server) |
| backups | `permtracker-backup.timer` | 3:15 AM Eastern: full SQL dump, zstd, checked to end in COMMIT, newest 7 kept, `backups/LAST_OK` |

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
4. `permtracker.app` and `www` DNS records become proxied CNAMEs to the tunnel.
5. Enable the timers here; remove Vercel's crons; move the Mac's launchd jobs.
6. Check Google sign-in (Convex sends Google back to permtracker.app, so it can
   only be tested on the real domain). Rollback: point the two DNS records back
   to Vercel.
