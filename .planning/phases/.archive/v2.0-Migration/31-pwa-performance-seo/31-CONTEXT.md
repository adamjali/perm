# Phase 31: PWA + Performance + SEO - Context

**Gathered:** 2026-01-10
**Status:** Ready for planning

<vision>
## How This Should Work

This is the final polish phase before going live. The app should feel **production-ready and best-in-class** — fast, installable, and discoverable.

**PWA Experience:**
- Fully installable on mobile home screens with a seamless install prompt
- **Full offline capability** — users can view cached cases and data even without network connection
- Should feel like a native app when installed, matching or exceeding v1 PWA behavior
- Aim for best-in-class PWA examples like Twitter Lite / Starbucks PWA

**Performance:**
- Sub-second loads, snappy interactions — the app should feel instant
- Heavy focus on bundle size, Core Web Vitals optimization
- Lighthouse 90+ across all categories (Performance, Accessibility, Best Practices, SEO)

**SEO:**
- Proper metadata on ALL pages, including authenticated pages (for bookmarks, sharing, browser tabs)
- Marketing/public pages optimized for search ranking (immigration attorneys searching for PERM tracking)
- Sitemap, robots.txt, structured data

</vision>

<essential>
## What Must Be Nailed

- **Speed** — Sub-second loads, instant-feeling interactions
- **PWA install experience** — Seamless install, works great as installed mobile app
- **SEO visibility** — Show up in Google when attorneys search for PERM tracking tools
- **Offline data access** — Users can view cached cases even without network
- **Lighthouse 90+** — Green scores across all four categories

</essential>

<boundaries>
## What's Out of Scope

- No artificial constraints — do whatever's needed to ship production-ready
- Focus is optimization, not new features (though may need to add offline data caching infrastructure)
- This is the final phase before data migration — everything should be polished

</boundaries>

<specifics>
## Specific Ideas

- Lighthouse targets: 90+ Performance, 90+ Accessibility, 90+ Best Practices, 90+ SEO
- Match or exceed v1 PWA behavior (v1 already had PWA working)
- Reference best-in-class PWAs: Twitter Lite, Starbucks PWA
- Full offline capability for viewing cached case data (not just offline shell)

</specifics>

<notes>
## Additional Context

**CRITICAL from project CLAUDE.md:** The service worker **MUST** follow these rules:
- Only cache static assets (images, fonts, icons)
- Network-first for everything else
- **NEVER cache HTML files**
- **NEVER cache JavaScript files**
- **NEVER cache API responses**

Why? Caching HTML/JS caused deployment issues in v1 where users couldn't see updates.

**Challenge:** User wants full offline data access, but we can't cache API responses per the rules. Will need to solve this with Convex's offline/caching capabilities rather than service worker caching.

This is the second-to-last phase — Phase 32 is Data Migration + Go-Live. Everything built here must be production-ready.

</notes>

---

*Phase: 31-pwa-performance-seo*
*Context gathered: 2026-01-10*
