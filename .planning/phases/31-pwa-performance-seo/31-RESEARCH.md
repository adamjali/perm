# Phase 31: PWA + Performance + SEO - Research

**Researched:** 2026-01-10
**Domain:** Next.js 16 PWA, Convex Offline, Service Worker, Core Web Vitals, SEO
**Confidence:** HIGH

<research_summary>
## Summary

Researched the complete stack for implementing PWA, performance optimization, and SEO in Next.js 16 with Convex backend.

**Key findings:**

1. **Serwist** is the recommended PWA library for Next.js 16 (successor to next-pwa, better Turbopack compatibility)
2. **Convex has NO native offline persistence** - only optimistic updates for perceived responsiveness. True offline requires third-party solutions (Replicate, Replicache) which are complex
3. **Service worker caching** must be extremely conservative - NetworkOnly for HTML/JS, CacheFirst only for static assets (images, fonts)
4. **Next.js 16 has built-in** manifest.ts, sitemap.ts, robots.ts generation - no external libraries needed
5. **Core Web Vitals** optimization requires Server Components, next/image priority, and careful script management

**Primary recommendation:** Use Serwist for PWA with strict NetworkOnly caching for HTML/JS. For offline data, implement service worker offline shell only (not full offline data) - true offline data caching with Convex requires significant architectural changes not justified for v2.0.

</research_summary>

<standard_stack>
## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@serwist/next` | 9.x | PWA integration for Next.js | Successor to next-pwa, Turbopack compatible |
| `serwist` | 9.x | Service worker runtime | Modern Workbox fork, actively maintained |
| Next.js built-in | 16.1.0 | manifest.ts, sitemap.ts, robots.ts | No extra deps needed for SEO/PWA metadata |
| `@next/bundle-analyzer` | 15.x | Bundle size analysis | Official Next.js tool |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vercel/speed-insights` | 1.x | Real User Metrics | Production Core Web Vitals monitoring |
| `next-seo` | 6.x | JSON-LD structured data | Only if need complex structured data |

### What NOT to Use

| Library | Reason |
|---------|--------|
| `next-pwa` | Unmaintained, requires webpack for Next.js 16 |
| `@ducanh2912/next-pwa` | Same author as Serwist, but older - use Serwist |
| `workbox-*` directly | Serwist wraps this, don't use raw Workbox |

**Installation:**
```bash
pnpm add @serwist/next
pnpm add -D serwist @next/bundle-analyzer
```

</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure

```
v2/
├── app/
│   ├── manifest.ts           # PWA manifest (Next.js built-in)
│   ├── sitemap.ts            # Dynamic sitemap (Next.js built-in)
│   ├── robots.ts             # robots.txt (Next.js built-in)
│   ├── sw.ts                 # Service worker source (Serwist)
│   └── layout.tsx            # Root layout with metadata
├── public/
│   ├── sw.js                 # Compiled service worker (generated)
│   ├── sw-push.js            # Push notification SW (existing)
│   ├── icon-192.png          # PWA icons
│   └── icon-512.png
└── next.config.mjs           # Serwist integration
```

### Pattern 1: Next.js Built-in Manifest

**What:** Use `app/manifest.ts` instead of static `manifest.json`
**When to use:** Always for Next.js 16+ App Router

```typescript
// app/manifest.ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PERM Tracker',
    short_name: 'PERM Tracker',
    description: 'Free PERM case tracking software for immigration attorneys',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#a3e635', // Matches v1
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  }
}
```

### Pattern 2: Dynamic Sitemap Generation

**What:** Generate sitemap from Convex data at build/request time
**When to use:** For pages that need search indexing

```typescript
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export default async function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  // Static pages
  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 1 },
    { url: `${baseUrl}/demo`, lastModified: new Date(), changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'yearly' as const, priority: 0.5 },
  ]

  return staticPages
}
```

### Pattern 3: Safe Service Worker Caching

**What:** NetworkOnly for HTML/JS, CacheFirst only for static assets
**When to use:** ALWAYS - this prevents stale deployment issues

```typescript
// app/sw.ts
import { CacheFirst, NetworkOnly, Serwist } from 'serwist'

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // CRITICAL: Never cache HTML documents
    {
      matcher: ({ request }) => request.destination === 'document',
      handler: new NetworkOnly(),
    },
    // CRITICAL: Never cache JavaScript
    {
      matcher: ({ request }) => request.destination === 'script',
      handler: new NetworkOnly(),
    },
    // Safe: Cache images
    {
      matcher: ({ request }) => request.destination === 'image',
      handler: new CacheFirst({ cacheName: 'images' }),
    },
    // Safe: Cache fonts
    {
      matcher: ({ request }) => request.destination === 'font',
      handler: new CacheFirst({ cacheName: 'fonts' }),
    },
  ],
})

serwist.addEventListeners()
```

### Pattern 4: Page Metadata with generateMetadata

**What:** Dynamic metadata for each page
**When to use:** All pages for proper SEO

```typescript
// app/cases/[id]/page.tsx
import { Metadata } from 'next'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return {
    title: `Case Details | PERM Tracker`,
    description: 'View and manage PERM case details',
    robots: {
      index: false, // Authenticated pages shouldn't be indexed
      follow: false,
    },
  }
}
```

### Anti-Patterns to Avoid

- **CacheFirst for HTML/JS:** Causes stale deployments where users see old code
- **Precaching all pages:** App Router pages are dynamically rendered, don't precache
- **Static manifest.json:** Use manifest.ts for type safety and dynamic values
- **next-pwa package:** Outdated, requires webpack mode in Next.js 16

</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PWA manifest | Static JSON file | `app/manifest.ts` | Type-safe, dynamic, Next.js standard |
| Sitemap | Manual XML | `app/sitemap.ts` | Auto-updated, type-safe, handles arrays |
| robots.txt | Static file | `app/robots.ts` | Programmatic, environment-aware |
| Service worker | Vanilla JS | Serwist | Handles precaching, updates, strategies |
| Bundle analysis | Manual inspection | `@next/bundle-analyzer` | Visual, actionable |
| Image optimization | Manual srcset | `next/image` | Automatic format, sizing, lazy loading |
| Font loading | @font-face | `next/font` | Automatic optimization, no CLS |
| Script loading | `<script>` | `next/script` | Strategy control, performance |

**Key insight:** Next.js 16 has built-in solutions for most PWA/SEO needs. External libraries are only needed for the service worker (Serwist) and advanced bundle analysis.

</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Caching HTML/JavaScript in Service Worker

**What goes wrong:** Users see stale code after deployments, bugs persist even after fixes deployed
**Why it happens:** CacheFirst or StaleWhileRevalidate used for documents/scripts
**How to avoid:** Use NetworkOnly for all HTML and JavaScript - NEVER cache these
**Warning signs:** Users report "old version", fixes don't appear, need to clear cache manually
**Project-specific note:** v1 had "Nov 2025 401 infinite loop bug" caused by this exact issue

### Pitfall 2: Serwist + Turbopack Development

**What goes wrong:** Service worker not working in development
**Why it happens:** Serwist doesn't support Turbopack in dev mode
**How to avoid:** Disable SW in development (`disable: process.env.NODE_ENV === 'development'`)
**Warning signs:** SW registration fails, hot reload breaks

### Pitfall 3: Expecting Convex Offline Data

**What goes wrong:** Planning for offline case viewing without understanding Convex limitations
**Why it happens:** Optimistic updates ≠ offline persistence
**How to avoid:** Accept that Convex queries require network. Offline shell + "no connection" message is the realistic scope
**Warning signs:** Building complex IndexedDB sync when Convex doesn't support it natively

### Pitfall 4: Over-Precaching

**What goes wrong:** Large SW bundle, slow initial load
**Why it happens:** Precaching all pages/routes
**How to avoid:** Only precache critical static assets (icons, fonts). Let runtime caching handle rest
**Warning signs:** SW bundle > 1MB, "Precache limit exceeded" warnings

### Pitfall 5: Missing Image Dimensions

**What goes wrong:** Layout shift (high CLS), poor Lighthouse score
**Why it happens:** Images without width/height cause reflow when loaded
**How to avoid:** Always provide width/height or use `fill` with sized container
**Warning signs:** CLS > 0.1, "Image elements do not have explicit width and height"

### Pitfall 6: Blocking Third-Party Scripts

**What goes wrong:** Poor INP, slow TTI
**Why it happens:** Scripts loaded synchronously or with `beforeInteractive`
**How to avoid:** Use `strategy="lazyOnload"` for analytics, `afterInteractive` minimum
**Warning signs:** High TBT, INP > 200ms

</common_pitfalls>

<code_examples>
## Code Examples

### Serwist Integration (next.config.mjs)

```typescript
// Source: Serwist official docs + Next.js 16 patterns
import { spawnSync } from 'node:child_process'
import withSerwistInit from '@serwist/next'

const revision = spawnSync('git', ['rev-parse', 'HEAD'], {
  encoding: 'utf-8',
}).stdout?.trim() ?? crypto.randomUUID()

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  disable: process.env.NODE_ENV === 'development',
})

export default withSerwist({
  // existing Next.js config
})
```

### Dynamic robots.ts

```typescript
// Source: Next.js 16.1.0 official docs
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/dashboard/', '/cases/', '/settings/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

### Root Layout Metadata

```typescript
// Source: Next.js 16.1.0 official docs
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'PERM Tracker - Free Case Tracking for Immigration Attorneys',
    template: '%s | PERM Tracker',
  },
  description: 'Free PERM case tracking software for immigration attorneys. Track deadlines, manage cases, and never miss a filing date.',
  keywords: ['PERM', 'immigration', 'case tracking', 'labor certification', 'DOL'],
  authors: [{ name: 'PERM Tracker' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://permtracker.app',
    siteName: 'PERM Tracker',
    title: 'PERM Tracker - Free Case Tracking',
    description: 'Free PERM case tracking software for immigration attorneys.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PERM Tracker',
    description: 'Free PERM case tracking for immigration attorneys.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
  },
}
```

### PWA Install Prompt (Non-Intrusive)

```typescript
// Source: Web.dev patterns + Chrome Developers docs
'use client'
import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstallable, setIsInstallable] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return false

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    setDeferredPrompt(null)
    setIsInstallable(false)

    return outcome === 'accepted'
  }

  return { isInstallable, install }
}
```

### Service Worker Registration

```typescript
// Source: Serwist patterns
'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope)
        })
        .catch((error) => {
          console.error('SW registration failed:', error)
        })
    }
  }, [])

  return null
}
```

</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| next-pwa | Serwist | 2024 | next-pwa unmaintained, Serwist is official successor |
| manifest.json | app/manifest.ts | Next.js 14+ | Type-safe, dynamic, built-in |
| Static sitemap.xml | app/sitemap.ts | Next.js 14+ | Dynamic generation, no external libs |
| FID metric | INP metric | March 2024 | Must optimize Interaction to Next Paint, not First Input Delay |
| React 18 | React 19 | 2025 | Server Components default, new hooks |
| Pages Router | App Router | Next.js 13+ | Layouts, Server Components, streaming |

**New patterns to consider:**

- **Partial Prerendering (PPR):** Experimental in Next.js 14+, enables static shell + streaming dynamic
- **Vercel Speed Insights:** Real-user metrics for Core Web Vitals monitoring
- **React 19 features:** `use()` hook, Server Actions improvements

**Deprecated/outdated:**

- **next-pwa:** Unmaintained, requires webpack
- **Workbox directly:** Use Serwist wrapper
- **FID optimization:** Now INP (Interaction to Next Paint)
- **Static manifest.json:** Use manifest.ts

</sota_updates>

<open_questions>
## Open Questions

1. **Full Offline Data Access**
   - What we know: User requested full offline capability for viewing cached cases
   - What's unclear: Convex has no native offline persistence
   - Recommendation: Implement offline shell with "No connection" message. Full offline data would require Replicate or Replicache integration - defer to post-MVP. Document this limitation clearly.

2. **Push Notification + Main Service Worker Coordination**
   - What we know: v2 already has `sw-push.js` for push notifications
   - What's unclear: Whether to merge into single SW or keep separate
   - Recommendation: Keep separate. Push SW is simple and isolated. Main SW handles caching only. This avoids complexity and matches v1 pattern.

3. **Serwist Precache Manifest Size**
   - What we know: Serwist auto-generates precache manifest from build
   - What's unclear: How large it will be with v2's page structure
   - Recommendation: Configure to precache only icons/fonts. Test manifest size in development and adjust if too large.

</open_questions>

<convex_offline_reality>
## Convex Offline Reality Check

### What Convex Provides

**Built-in:**
- Optimistic updates (temporary local state during mutations)
- Automatic query caching (for online performance)
- Retry on network blips
- Subscription reconnection

**NOT Built-in:**
- IndexedDB persistence
- Offline query cache
- Offline mutation queue
- CRDT sync

### What This Means for Phase 31

The user wants "full offline capability for viewing cached cases." This is **NOT feasible without significant additional work:**

| Approach | Complexity | Time | Recommendation |
|----------|------------|------|----------------|
| Offline shell only | Low | 1 day | **Recommended for v2.0** |
| Replicate integration | High | 1-2 weeks | Post-MVP |
| Replicache integration | High | 1-2 weeks | Post-MVP |
| Custom IndexedDB layer | Very High | 2-4 weeks | Not recommended |

### Recommended v2.0 Scope

1. **PWA installable:** Yes (manifest + icons)
2. **Offline shell:** Yes (app shell loads, shows "offline" state)
3. **Cached static assets:** Yes (images, fonts)
4. **Offline case viewing:** No (requires architectural changes)
5. **Offline mutations:** No (not supported by Convex)

**Communicate clearly:** When offline, user sees app shell with friendly message: "You're offline. Case data will load when you're back online."

</convex_offline_reality>

<sources>
## Sources

### Primary (HIGH confidence)

- Context7: `/vercel/next.js/v16.1.0` - manifest.ts, sitemap.ts, robots.ts, metadata API, Image optimization
- Context7: `/serwist/serwist` - Service worker setup, caching strategies, Next.js integration
- Context7: `/llmstxt/convex_dev_llms-full_txt` - Optimistic updates, client caching (confirms no offline persistence)
- Official Next.js docs: PWA guide, metadata API, bundle analyzer
- v1 codebase: `frontend/public/sw.js` - Working safe caching pattern, post-Nov-2025-bug-fix

### Secondary (MEDIUM confidence)

- Web.dev: PWA install patterns, Core Web Vitals thresholds
- Chrome Developers: Workbox caching strategies overview
- Serwist pages.dev: Getting started, runtime caching

### Tertiary (LOW confidence - needs validation)

- Community articles on Next.js 16 PWA (cross-referenced with official docs)

</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Next.js 16 App Router, Serwist, Convex
- Ecosystem: PWA, SEO, Core Web Vitals
- Patterns: Service worker caching, metadata generation, performance optimization
- Pitfalls: Stale deployments, Convex offline limitations, CLS issues

**Confidence breakdown:**
- Standard stack: HIGH - verified with Context7 and official docs
- Architecture: HIGH - based on Next.js 16 official patterns
- Pitfalls: HIGH - includes project-specific v1 bug learnings
- Code examples: HIGH - from Context7 and official sources
- Convex offline: HIGH - confirmed limitation in official docs

**Research date:** 2026-01-10
**Valid until:** 2026-02-10 (30 days - stable ecosystem)

</metadata>

---

*Phase: 31-pwa-performance-seo*
*Research completed: 2026-01-10*
*Ready for planning: yes*
