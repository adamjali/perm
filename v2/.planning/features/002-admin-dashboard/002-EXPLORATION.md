# Feature 002: Exploration

**Feature:** Admin Dashboard - protected /admin route with full admin panel
**Date:** 2026-02-02

## Similar Features

- **Dashboard page** (`src/app/(authenticated)/dashboard/`) - Server+Client component pattern, stats grid, data fetching via Convex useQuery
- **Cases page** (`src/app/(authenticated)/cases/`) - Table display, URL state for filters, bulk selection, export

## Architecture Patterns

- **Route structure:** `page.tsx` (server, metadata) + `PageClient.tsx` (client, interactive)
- **Auth:** `useQuery(api.users.currentUser)` + redirect if null
- **Data:** Convex `useQuery`/`useMutation`, real-time, `undefined` = loading
- **Layout:** Authenticated layout with Header, Footer, dot pattern bg, max-w-7xl container
- **UI:** Neobrutalist - border-2, shadow-hard, hover lift, lime green primary, Space Grotesk headings
- **Components:** shadcn-style on Radix UI + class-variance-authority

## Key Files

- `convex/admin.ts:922-1080` - `getUserSummary` (internalQuery) - has ALL data needed
- `convex/lib/auth.ts` - `getCurrentUserId` helper
- `src/app/(authenticated)/layout.tsx` - Auth layout wrapper
- `src/lib/constants/navigation.ts` - Nav links (AUTHENTICATED_NAV_LINKS)
- `src/components/dashboard/SummaryTilesGrid.tsx` - Stats grid pattern
- `src/components/ui/card.tsx` - Card component
- `src/app/globals.css` - Design tokens

## Integration Points

1. **Backend:** `getUserSummary` is `internalQuery` — need public wrapper with admin auth check
2. **Navigation:** Add admin link to AUTHENTICATED_NAV_LINKS (conditionally for admin)
3. **Route:** New `src/app/(authenticated)/admin/` directory
4. **Admin emails:** Need env var or hardcoded list for admin check
