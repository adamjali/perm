# v2.0 Feature Inventory

> **Purpose:** Complete checklist of 200+ features that MUST be preserved
> **Created:** 2025-12-20
> **Updated:** 2025-12-22
> **Verified:** 2025-12-20 (Phase 12 - 98.7% accuracy)
> **Use:** Verify at Phase 32 (Go-Live) that nothing is lost
>
> **Reference:** See `V2_ORIGINAL_VISION.md` for complete requirements

---

## Instructions

Before go-live, verify EVERY checkbox. No feature can be lost.

---

## 1. Authentication (10 features)

- [ ] Email/password registration
- [ ] Email/password login
- [ ] Google OAuth 2.0 sign up
- [ ] Google OAuth 2.0 login
- [ ] Refresh token rotation
- [ ] Session management (logout revokes all tokens)
- [ ] Password reset flow *(v1.0: request only, confirm returns 501)*
- [ ] JWT token management (15-min expiry)
- [ ] Client info tracking (IP, user agent)
- [ ] Profile photo from Google

---

## 2. Case Management (15 features)

- [ ] Create case with all 50+ fields
- [ ] List cases with pagination
- [ ] Get case details
- [ ] Update case (partial)
- [ ] Soft delete case
- [ ] Case validation without save
- [ ] Auto-calculated fields:
  - [ ] PWD expiration date
  - [ ] ETA 9089 expiration date
  - [ ] Recruitment end date
  - [ ] Case status from dates
- [ ] Beneficiary identifier auto-generation
- [ ] Case export to CSV
- [ ] Case export to JSON
- [ ] Case import from JSON
- [ ] Import field mapping (old/new formats)

---

## 3. Date Validation (20 features)

- [ ] PWD filing < determination < expiration
- [ ] PWD expiration calculation (Apr 2-Jun 30 rule)
- [ ] Sunday ads must be on Sundays
- [ ] Second Sunday ad > first Sunday ad
- [ ] Job order minimum 30 days
- [ ] Notice of Filing 10 business days
- [ ] Business day calculator (federal holidays)
- [ ] ETA 9089 filing window (30-180 days)
- [ ] ETA 9089 before PWD expiration (when applicable)
- [ ] I-140 filing within 180 days
- [ ] I-140 filing > certification
- [ ] I-140 approval > filing
- [ ] RFI due > received
- [ ] RFE due > received
- [ ] Error vs warning distinction
- [ ] Cross-field validation
- [ ] Real-time validation on input
- [ ] Validation messages with guidance
- [ ] Professional occupation rules
- [ ] Weekend/holiday deadline extension

---

## 4. Case Status System (v2.0: Two-Tier 5+6)

> See `V2_ORIGINAL_VISION.md` for complete requirements

### Case Status (5 values, colored tags)
- [ ] PWD status (blue #0066FF)
- [ ] Recruitment status (purple #9333ea)
- [ ] ETA 9089 status (orange #D97706, yellow #EAB308 when working)
- [ ] I-140 status (green #059669)
- [ ] Closed/Archived status (gray #6B7280)

### Progress Status (6 values, no color)
- [ ] Working on it (default)
- [ ] Waiting for intake (manual)
- [ ] Filed (auto, manual override)
- [ ] Approved (auto, manual override)
- [ ] Under review (manual)
- [ ] RFI/RFE (auto when active)

### Dashboard Tiles
- [ ] PWD tile with subtexts ("X working, Y filed")
- [ ] Recruitment tile with subtexts ("X ready, Y in progress")
- [ ] ETA 9089 tile with subtexts ("X prep, Y RFI, Z filed")
- [ ] I-140 tile with subtexts ("X prep, Y RFE, Z filed")
- [ ] Complete tile (I-140 + Approved)
- [ ] Closed/Archived tile (separate from Complete)

---

## 5. Deadline Tracking (15 features)

- [ ] Upcoming deadlines endpoint (days ahead)
- [ ] Comprehensive deadlines (grouped by urgency)
- [ ] Deadline urgency levels (critical, high, normal, overdue)
- [ ] PWD expiration tracking
- [ ] Recruitment expiration tracking
- [ ] ETA 9089 filing window tracking
- [ ] ETA 9089 expiration tracking
- [ ] RFI response deadline tracking
- [ ] RFE response deadline tracking
- [ ] Deadline relevance system (hide superseded)
- [ ] Deadline cleanup on stage progress
- [ ] Deadline cleanup on case delete
- [ ] Deadline cleanup on case archive
- [ ] Background scheduler for reminders
- [ ] Manual scheduler trigger (admin)

---

## 6. Notifications (15 features)

- [ ] Notification types (status_change, deadline_reminder, new_message, rfi_received, general)
- [ ] Notification priorities (urgent, high, normal, low)
- [ ] Get notifications (paginated)
- [ ] Filter by type
- [ ] Filter by read status
- [ ] Mark as read (individual)
- [ ] Mark as read (bulk)
- [ ] Delete notification (individual)
- [ ] Delete notification (bulk)
- [ ] Unread count badge
- [ ] Delete notifications on case delete
- [ ] Notification cleanup on stage progress
- [ ] Notification settings:
  - [ ] Email status updates
  - [ ] Email deadline reminders
  - [ ] Email weekly summary
  - [ ] Email RFI/RFE alerts

---

## 7. Recruitment (8 features)

- [ ] Auto-generated recruitment summary
- [ ] Custom recruitment summary override
- [ ] Recruitment completion detection
- [ ] Sunday newspaper ads tracking
- [ ] SWA job order tracking
- [ ] Notice of Filing tracking
- [ ] Additional steps (professional positions)
- [ ] Recruitment status calculation

---

## 8. RFI Management (6 features)

- [ ] Create RFI entry
- [ ] List RFI entries
- [ ] Get RFI details
- [ ] Update RFI
- [ ] Delete RFI
- [ ] RFI deadline in comprehensive list

---

## 9. RFE Management (6 features)

- [ ] Create RFE entry
- [ ] List RFE entries
- [ ] Get RFE details
- [ ] Update RFE
- [ ] Delete RFE
- [ ] RFE deadline in comprehensive list

---

## 10. AI Chatbot (25 features)

- [ ] Multi-provider support (Gemini, Groq, OpenRouter, Cerebras, Mistral)
- [ ] Automatic provider fallback
- [ ] Authenticated chat (full features)
- [ ] Public chat (rate-limited)
- [ ] Web search integration
- [ ] Page context awareness
- [ ] Streaming responses
- [ ] Conversation history
- [ ] Context compaction (summarization)
- [ ] Request ID tracking
- [ ] Tools:
  - [ ] Create case
  - [ ] Update case
  - [ ] Query cases
  - [ ] Get case data
  - [ ] Recruitment form handling
  - [ ] Google Calendar sync
  - [ ] Get notifications
  - [ ] Mark notifications read
  - [ ] Get user settings
  - [ ] Update user settings
  - [ ] Navigate to pages
  - [ ] Get form field options
  - [ ] Status suggestions
- [ ] Error handling with recovery
- [ ] Provider/model info in response

---

## 11. Calendar Integration (12 features)

- [ ] Google OAuth connection
- [ ] Calendar permission management
- [ ] Encrypted token storage
- [ ] Event creation on case create
- [ ] Event update on case update
- [ ] Event deletion on case delete
- [ ] Event ID tracking in case
- [ ] Per-event-type sync preferences
- [ ] Case-level sync toggle
- [ ] Two-way sync (webhooks) *(v1.0: not implemented, v2.0 Phase 30)*
- [ ] Deadline relevance cleanup
- [ ] Sync status display

---

## 12. Data Import/Export (6 features)

- [ ] Export all cases to CSV
- [ ] Export all cases to JSON (with metadata)
- [ ] Import from JSON
- [ ] Old format (camelCase) support
- [ ] Duplicate detection
- [ ] Per-case error reporting

---

## 13. User Settings (12 features)

- [ ] Profile update (name, email, phone, job title, company)
- [ ] Profile photo from OAuth
- [ ] UI preferences (dark mode, privacy mode)
- [ ] Notification preferences (4 email toggles)
- [ ] Calendar sync preferences (per event type)
- [ ] Reminder days before setting
- [ ] Get current user
- [ ] Update settings
- [ ] Preferences auto-create with defaults
- [ ] Password change
- [ ] Account management
- [ ] Data export

---

## 14. Contact Form (3 features)

- [ ] Anonymous contact submission
- [ ] Authenticated contact submission
- [ ] Email delivery via Resend

---

## 15. Frontend Pages (15 pages)

- [ ] Landing page (index.html)
- [ ] Login page
- [ ] Register page
- [ ] Demo page
- [ ] Dashboard
- [ ] Cases list
- [ ] Add case
- [ ] Edit case
- [ ] Case detail
- [ ] Calendar view
- [ ] Timeline view
- [ ] Notifications center
- [ ] Settings (with tabs)
- [ ] Privacy policy
- [ ] Terms of service

---

## 16. PWA Features (7 features)

- [ ] Service worker (network-first)
- [ ] Static asset caching only
- [ ] Never cache HTML/JS
- [ ] Cache busting on update
- [ ] Web manifest
- [ ] Offline graceful degradation
- [ ] Install prompt

---

## 17. Security (10 features)

- [ ] Row-level security equivalent (auth checks everywhere)
- [ ] Password hashing (bcrypt)
- [ ] JWT with short expiry
- [ ] Token rotation
- [ ] Token revocation on logout
- [ ] CORS configuration
- [ ] Input validation (Pydantic backend, custom frontend)
- [ ] OAuth token encryption
- [ ] Sentry error tracking (no PII)
- [ ] CSP headers

---

## 18. API Features (8 features)

- [ ] REST API endpoints
- [ ] API documentation (Swagger/ReDoc equivalent)
- [ ] Health check endpoint
- [ ] Root endpoint with version
- [ ] Response caching headers
- [ ] GZip compression
- [ ] Rate limiting
- [ ] Error responses with detail

---

## 19. Frontend Utilities (15 features)

- [ ] Dark mode toggle with persistence
- [ ] Privacy mode toggle
- [ ] Toast notifications
- [ ] Mobile menu
- [ ] Profile dropdown
- [ ] Parallax effects
- [ ] Scroll reveal animations
- [ ] Status badges (colored by stage)
- [ ] Mobile responsive
- [ ] Form validation helpers
- [ ] Date validation helpers
- [ ] Unsaved changes warning
- [ ] Activity tracking for timeout
- [ ] Timeout warning modal
- [ ] Sentry frontend integration

---

## 20. Design System (10 features)

> **⚠️ frontend-design skill (its a plug-in) REQUIREMENT**
>
> All work on design system features MUST reference `.planning/FRONTEND_DESIGN_SKILL.md` (the frontend-design skill, its a plug-in) for comprehensive design requirements and component patterns.

- [ ] Neobrutalist design (hard shadows)
- [ ] Space Grotesk headings
- [ ] Inter body text
- [ ] Forest Green accent (#228B22)
- [ ] Accessible color palette
- [ ] Loading states/spinners
- [ ] Error states
- [ ] Empty states
- [ ] Responsive breakpoints
- [ ] Typography scale

---

## v2.0 New Features & Enhancements

> Added 2025-12-22 per `V2_ORIGINAL_VISION.md`

### Schema Additions
- [ ] Internal case number field (attorney reference)
- [ ] PWD case number field (optional)
- [ ] Structured notes (timestamped, pending/done/deleted status)
- [ ] Progress status override flag

### Validation Enhancements
- [ ] RFI due date strict 30 days (NOT editable)
- [ ] Notice end date extend-only (min 10 business days)
- [ ] Job order end date extend-only (min 30 days)
- [ ] Cascade recalculation rules (5 triggers)
- [ ] Auto-close edge cases (<60 days remaining)

### UI Enhancements - Dashboard
- [ ] Tile subtexts with counts per sub-status
- [ ] Separate Complete tile from Closed/Archived
- [ ] Waiting period countdown display

### UI Enhancements - Case List
- [ ] Filter by Case Status (5 values)
- [ ] Filter by Progress Status (6 values)
- [ ] Show by: Active, All, Completed, Closed/Archived
- [ ] Sort: Recently updated, Favorites, Next deadline (default), Employer, Status, Filing dates
- [ ] Column: Recruitment started (earliest date)
- [ ] Column: Recruitment expires (first+180 days)
- [ ] Column: ETA 9089 filing window opens (last+30 days)
- [ ] Move export/import to bottom
- [ ] Count display: "Showing X of Y total cases"

### UI Enhancements - Forms
- [ ] Professional toggle animation (Lottie)
- [ ] Dropdown method deduplication (3 max)
- [ ] Extend-only end date fields

### UI Enhancements - Case View
- [ ] Button: Timeline toggle
- [ ] Button: Calendar sync toggle
- [ ] Button: Close/Archive case
- [ ] Display: ETA 9089 filing window opens
- [ ] Display: Upcoming deadline at top
- [ ] Rename: "Recruitment Summary" → "Recruitment Results"

### Settings Enhancements
- [ ] Remove RFE from notification types
- [ ] Calendar sync option reordering (7 items in order)

### Session Management
- [ ] Fix infinite leave/cancel popup bug
- [ ] Single confirmation dialog on unsaved changes
- [ ] Proper beforeunload cleanup

### Tech Stack (v2.0)
- [ ] Next.js 16+ / React
- [ ] Convex (serverless, real-time)
- [ ] Vercel AI SDK + CopilotKit
- [ ] Tailwind CSS v4

---

## Verification Checklist

At go-live (Phase 32):

1. [ ] Go through every section above
2. [ ] Test each feature works
3. [ ] Compare against current production
4. [ ] Document any intentional omissions
5. [ ] Get user sign-off

---

## Feature Count Summary

| Category | Count |
|----------|-------|
| Authentication | 10 |
| Case Management | 15 |
| Date Validation | 20 |
| Case Stages | 11 |
| Deadline Tracking | 15 |
| Notifications | 15 |
| Recruitment | 8 |
| RFI Management | 6 |
| RFE Management | 6 |
| AI Chatbot | 25 |
| Calendar Integration | 12 |
| Data Import/Export | 6 |
| User Settings | 12 |
| Contact Form | 3 |
| Frontend Pages | 15 |
| PWA Features | 7 |
| Security | 10 |
| API Features | 8 |
| Frontend Utilities | 15 |
| Design System | 10 |
| **TOTAL** | **229** |

---

*Last updated: 2025-12-20*
*Verified: 2025-12-20 (Phase 12) - See VERIFICATION_REPORT.md*
