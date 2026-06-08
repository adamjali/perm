# Data Retention Policy

> PERM Tracker data retention schedules for SOC 2 Confidentiality (C1)

## Retention Schedules

| Data Type | Retention | Mechanism | Notes |
|-----------|-----------|-----------|-------|
| User accounts & profiles | Until deletion | User-initiated | 30-day grace period on deletion |
| PERM cases | Until deletion | User-initiated | Soft delete, then purge with account |
| AI conversations | **90 days** | Daily cron (3 AM UTC) | Auto-deleted after 90 days of inactivity |
| Read notifications | **90 days** | Hourly cron (:30) | Unread notifications preserved regardless of age |
| Rate limit records | **24 hours** | Hourly cron (:15) | Processed in batches of 100 |
| Audit logs | **Indefinite** | N/A | Required for compliance, never auto-deleted |
| System error logs | Indefinite | Convex DB | Tracked in `systemErrors` table |

## Automated Cleanup Jobs

All cleanup runs via `convex/crons.ts`:

| Cron | Schedule | Handler |
|------|----------|---------|
| `deadline-reminders` | Daily 9 AM EST (14:00 UTC) | `checkDeadlineReminders` |
| `notification-cleanup` | Hourly :30 | `cleanupOldNotifications` |
| `weekly-digest` | Monday 9 AM EST | `sendWeeklyDigest` |
| `account-deletion-cleanup` | Hourly :45 | `processExpiredDeletions` |
| `rate-limit-cleanup` | Hourly :15 | `cleanupRateLimits` |
| `conversation-ttl-cleanup` | Daily 3:00 AM UTC | `cleanupExpiredConversations` |

## Account Deletion

1. User requests deletion via Settings > Delete Account
2. Account enters 30-day grace period (`deletedAt` set to now + 30 days)
3. User can cancel during grace period
4. After grace period, `processExpiredDeletions` cron purges all data
5. Purge includes: cases, conversations, messages, notifications, profile, user record

## AI Provider Data Retention

| Provider | Retention | Training Use |
|----------|-----------|-------------|
| Google Gemini | Up to 55 days (abuse monitoring) | No |
| OpenRouter | Zero Data Retention (ZDR) | No |
| Mistral AI | Per DPA terms | No |
| Groq | Zero Data Retention (ZDR) | No |
| Cerebras | Per DPA terms | No |

## Data Export

Users can export all their data at any time via Settings > "Export All My Data" button.

Export includes:
- User record (email, name, creation date)
- Profile (with sensitive tokens redacted)
- All cases (with FEINs decrypted for export)
- All conversations and messages
- All notifications
- Audit log entries

Format: JSON file download (`perm-tracker-export-YYYY-MM-DD.json`)
