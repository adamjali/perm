# Feature 002: Clarifications

**Feature:** Admin Dashboard
**Date:** 2026-02-02

## Questions & Answers

### Admin Access
**Q:** Which email(s) should have admin access?
**A:** [ADMIN_EMAIL env var] only

### Navigation
**Q:** Should the admin link show in the main nav bar?
**A:** Yes, in header nav (only renders for admin users)

### User Management Actions
**Q:** What user management actions do you need?
**A:** Full management - Delete, edit, export CSV, send emails, etc.

## Implications

- Single admin email hardcoded (or env var) — no admin role in DB needed for now
- Header needs conditional admin link — check user email client-side
- Full management means mutations for: delete user, edit user profile, export CSV, send email to user
- Backend needs public query wrapper with admin email check
- Need additional admin mutations beyond the existing getUserSummary read
