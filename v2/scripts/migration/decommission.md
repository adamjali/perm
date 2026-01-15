# PERM Tracker v1 Decommission Checklist

This document tracks the decommission of v1 services after successful v2 go-live.

**Go-Live Date:** 2026-01-15
**v2 URL:** https://permtracker.app

---

## T+0: Go-Live Complete

- [ ] v2 verified working for 24 hours
- [ ] No critical bug reports
- [ ] User feedback collected
- [ ] Monitoring in place (Convex dashboard, Vercel analytics)

**Sign-off:** _________________ Date: _________

---

## T+24hr: Calendar Cleanup

Clean up v1 calendar events from users' Google Calendars.

- [ ] Run dry-run first: `./05_cleanup_v1_calendar.sh --dry-run`
- [ ] Review dry-run output
- [ ] Run live cleanup: `./05_cleanup_v1_calendar.sh`
- [ ] Verify events deleted (spot check 3 users)
- [ ] Log cleanup results

**Required Environment Variables:**
```bash
export SUPABASE_URL="https://[v1-project].supabase.co"
export SUPABASE_KEY="[v1-service-key]"
export ENCRYPTION_KEY="[v1-encryption-key]"
export GOOGLE_CLIENT_ID="[google-client-id]"
export GOOGLE_CLIENT_SECRET="[google-client-secret]"
```

**Sign-off:** _________________ Date: _________

---

## T+7 Days: Render Decommission

Decommission the v1 backend API running on Render.

- [ ] Confirm v2 stable for 7 days
- [ ] Verify no traffic to old API (Render dashboard)
- [ ] Scale Render service to 0 instances
- [ ] Wait 24 hours, verify no issues
- [ ] Delete Render service

**Render Dashboard:** https://dashboard.render.com

**Sign-off:** _________________ Date: _________

---

## T+14 Days: Code Cleanup (Optional)

Clean up the repository if v2 code is still in `v2/` subdirectory.

- [ ] Confirm all services running smoothly
- [ ] Run: `./06_decommission.sh --preview` to see changes
- [ ] Run: `./06_decommission.sh --confirm` to execute
- [ ] Verify tests pass after cleanup
- [ ] Update any remaining documentation
- [ ] Push changes to remote

**Note:** This step is optional if you've already restructured the repo.

**Sign-off:** _________________ Date: _________

---

## T+30 Days: Supabase Decommission

Decommission the v1 PostgreSQL database.

- [ ] Export final Supabase backup
  ```bash
  # From Supabase dashboard: Settings > Database > Backups
  # Download latest backup
  ```
- [ ] Store backup in secure location (with retention label)
- [ ] Verify v2 has all data migrated correctly
- [ ] Pause Supabase project (Settings > General > Pause Project)
- [ ] Document backup location

**Supabase Dashboard:** https://supabase.com/dashboard

**Sign-off:** _________________ Date: _________

---

## T+90 Days: Final Cleanup (Optional)

- [ ] Review if paused Supabase project can be deleted
- [ ] Archive this decommission checklist
- [ ] Remove any remaining v1 references from documentation

**Sign-off:** _________________ Date: _________

---

## Emergency Rollback Procedures

If critical issues are discovered at any phase:

### Before T+7 Days (Render still running)
1. Point DNS back to v1 Vercel deployment
2. Notify users of rollback
3. Debug and fix v2 issues
4. Re-attempt go-live when fixed

### After T+7 Days (Render decommissioned)
1. Re-deploy Render service from git history
2. Point DNS back to v1
3. May need to restore Supabase from backup if T+30 days passed

### Data Rollback
If data corruption is discovered:
1. Stop all user access to v2
2. Identify point of corruption
3. Restore from Convex backup or re-migrate from Supabase

---

## Contact Information

- **v2 Monitoring:** Convex Dashboard, Vercel Analytics
- **v1 Services:** Render (backend), Supabase (database), Vercel (frontend)
- **DNS:** Vercel Domains

---

*Last Updated: 2026-01-15*
