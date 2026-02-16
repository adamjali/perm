# Performance Optimization Playbook

> Each optimization is independent. Apply one at a time, verify locally before moving on.
> **Impact:** 1-10 (10 = biggest performance gain)
> **Ease:** 1-10 (10 = easiest, zero risk)
> **Visual Risk:** whether it changes how the site looks/feels

---

## Tier 1: Pure Wins (no visual change, config only)

### 1. Compress Source Images
- **Impact: 9** | **Ease: 10** | **Visual Risk: None**
- Source PNGs are 1-4.5MB each. Next.js auto-converts to WebP/AVIF but starts from huge originals. Compressing sources makes optimization faster and reduces origin transfer.
- **Files:** `public/images/screenshots/*.png`, `public/images/content/*.png`
- **How:**
  ```bash
  pnpm add -D sharp-cli  # or use pngquant
  # For each image:
  npx sharp -i public/images/screenshots/dashboard.png -o public/images/screenshots/dashboard.png --quality 75 resize 1920
  ```
  Or with pngquant (lossy, better compression):
  ```bash
  brew install pngquant
  pngquant --quality=65-80 --force --output public/images/screenshots/dashboard.png public/images/screenshots/dashboard.png
  ```
- **Targets:**
  | File | Before | Target |
  |------|--------|--------|
  | dashboard.png | 4.5MB | ~400KB |
  | cases.png | 4.4MB | ~400KB |
  | case-summary.png | 2.6MB | ~250KB |
  | tutorials-hero.png | 2.3MB | ~200KB |
  | guides-hero.png | 2.2MB | ~200KB |
  | blog-hero.png | 1.7MB | ~150KB |
  | perm-tracker-desk.png | 1.3MB | ~120KB |
  | perm-process-infographic.png | 1.2MB | ~120KB |
  | homepage.png | 1.4MB | ~150KB |
  | calendar.png | 1.2MB | ~120KB |
- **Verify:** Open images in browser, confirm quality is acceptable. No code changes needed.

---

### 2. Enable AVIF Format
- **Impact: 4** | **Ease: 10** | **Visual Risk: None**
- AVIF is ~30% smaller than WebP. Next.js auto-serves based on browser Accept header.
- **File:** `next.config.ts`
- **Change:**
  ```ts
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  ```
- **Verify:** `pnpm build` succeeds. Images still display. Check network tab — AVIF served to Chrome.

---

### 3. Enable React Compiler
- **Impact: 3** | **Ease: 10** | **Visual Risk: None**
- Automatic memoization without manual useMemo/useCallback. Free re-render reduction.
- **File:** `next.config.ts`
- **Changes:**
  ```ts
  const nextConfig: NextConfig = {
    reactCompiler: true,  // add this
    // ...
  };
  ```
  ```bash
  pnpm add -D babel-plugin-react-compiler
  ```
- **Verify:** `pnpm build` succeeds. Click around — everything works the same.

---

### 4. Add zod to optimizePackageImports
- **Impact: 3** | **Ease: 10** | **Visual Risk: None**
- Zod uses barrel exports. Without this, two ~265KB chunks appear on pages that import any Zod schema.
- **File:** `next.config.ts`
- **Change:**
  ```ts
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "motion/react", "zod"],
  },
  ```
- **Verify:** `pnpm build` succeeds.

---

### 5. Remove Duplicate framer-motion Package
- **Impact: 2** | **Ease: 10** | **Visual Risk: None**
- Both `framer-motion` and `motion` are installed (same library, different package names).
- **How:**
  ```bash
  # First verify nothing imports from "framer-motion":
  grep -r "from ['\"]framer-motion" src/ --include="*.tsx" --include="*.ts"
  # If clean:
  pnpm remove framer-motion
  ```
- **Verify:** `pnpm build` succeeds. All animations still work.

---

### 6. Sentry bundleSizeOptimizations
- **Impact: 5** | **Ease: 9** | **Visual Risk: None**
- Strips tracing, debug statements, and unused replay modules from Sentry SDK. ~137KB savings.
- **File:** `next.config.ts` (in sentryOptions)
- **Change:**
  ```ts
  bundleSizeOptimizations: {
    excludeTracing: true,
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
  ```
- **Verify:** `pnpm build` succeeds. Sentry still captures errors on authenticated pages.

---

## Tier 2: Medium Effort, High Impact (some code changes, test carefully)

### 7. Remove Sentry SDK from Public Pages
- **Impact: 8** | **Ease: 6** | **Visual Risk: None**
- The Sentry webpack plugin auto-injects sentry.client.config.ts as an entry point on ALL pages (287KB). Public pages don't need client-side error tracking.
- **Files:**
  - `sentry.client.config.ts` → make empty (just a comment)
  - Create `src/components/layout/SentryClientInit.tsx` → dynamic import + requestIdleCallback
  - `src/app/(auth)/layout.tsx` → add `<SentryClientInit />`
  - `src/app/(authenticated)/layout.tsx` → add `<SentryClientInit />`
  - `src/app/global-error.tsx` → change to dynamic import
- **SentryClientInit.tsx pattern:**
  ```tsx
  "use client";
  import { useEffect } from "react";
  let sentryInitialized = false;
  export function SentryClientInit() {
    useEffect(() => {
      if (sentryInitialized) return;
      sentryInitialized = true;
      const init = async () => {
        const Sentry = await import("@sentry/nextjs");
        Sentry.init({ /* same config as before */ });
        // Lazy-load replay when sampled
        const client = Sentry.getClient();
        if (client && Math.random() < 0.1) {
          Sentry.lazyLoadIntegration("replayIntegration").then((replay) => {
            client.addIntegration(replay({ maskAllText: true, blockAllMedia: true }));
          }).catch(() => {});
        }
      };
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => init(), { timeout: 5000 });
      } else {
        setTimeout(init, 100);
      }
    }, []);
    return null;
  }
  ```
- **Verify:** Public pages load without Sentry chunk in network tab. Login, use app — errors still captured.

---

### 8. Split Providers (Public vs Authenticated)
- **Impact: 7** | **Ease: 5** | **Visual Risk: Low — test auth flow carefully**
- Currently `ConvexClientProvider` wraps ALL pages including public. This loads Convex WebSocket client, auth provider, and all their dependencies on every page.
- **Files:**
  - Create `src/app/shared-providers.tsx` → lightweight: ThemeProvider + Toaster + NavLinkProvider
  - `src/app/providers.tsx` → keep ConvexClientProvider only
  - `src/app/layout.tsx` → use SharedProviders instead of ConvexClientProvider
  - `src/app/(auth)/layout.tsx` → wrap with ConvexClientProvider
  - `src/app/(authenticated)/layout.tsx` → wrap with ConvexClientProvider
- **Verify:** Public pages work (home, demo, blog, contact). Auth pages work (login, signup). Dashboard loads. Sign in/out works.

---

### 9. Lazy-load Below-Fold Homepage Sections
- **Impact: 6** | **Ease: 6** | **Visual Risk: Low — sections appear on scroll**
- Sections below the fold (FAQ, CTA, Journey, etc.) don't need to load immediately.
- **Pattern:** Create `LazyHomeSections.tsx` using `next/dynamic` with `ssr: false` + IntersectionObserver wrapper.
- **Components to lazy-load:** FAQSection, CTASection, JourneySection, ContentShowcase, ContactSection, VideoShowcase
- **Keep eager:** HeroSection, TrustStrip, FeaturesGrid (above or near fold)
- **Verify:** Scroll through homepage — all sections appear smoothly. No jarring pop-in.

---

### 10. Lazy-load Testimonials (Senja Widget)
- **Impact: 4** | **Ease: 7** | **Visual Risk: None**
- Senja's embed script (380ms blocking) loads eagerly. Move TestimonialsSection into lazy-loaded sections.
- **How:** Move TestimonialsSection from page.tsx into LazyHomeSections (requires #9 first).
- **Verify:** Scroll to testimonials — widget loads when in view.

---

### 11. Defer Supademo Iframe on Demo Page
- **Impact: 5** | **Ease: 8** | **Visual Risk: Slight — shows "Loading tour..." placeholder briefly**
- The Supademo iframe loads heavy third-party JS. Wrap in IntersectionObserver so it only loads when scrolled near.
- **File:** Create `src/app/(public)/demo/SupademoEmbed.tsx`
- **Pattern:** Same as LazySection — IntersectionObserver with 300px rootMargin. Show placeholder until visible, then render iframe.
- **Verify:** Demo page loads fast. Scroll down — tour appears after brief placeholder.

---

### 12. Lazy-load ScrollToTop Button
- **Impact: 2** | **Ease: 8** | **Visual Risk: None**
- ScrollToTop imports motion/react. Wrap in `next/dynamic` with `ssr: false` to keep it out of the main bundle.
- **File:** Create `src/components/ui/lazy-scroll-to-top.tsx`
- **Verify:** Scroll down on any public page — back-to-top button still appears.

---

## Tier 3: Harder Changes (visual/UX impact, test thoroughly)

### 13. Composited Animations
- **Impact: 2** | **Ease: 7** | **Visual Risk: Subtle**
- `transition: all` on `.card-snappy` and `.press-effect` can trigger non-composited transitions. Scope to `transform, box-shadow` only.
- `scroll-progress` uses `width` (non-composited). Switch to `scaleX` with `transform-origin: left`.
- **File:** `src/app/globals.css`, `src/components/home/DecorativeElements.tsx`
- **Verify:** Hover over cards — still snappy. Scroll — progress bar still works.

---

### 14. Accessibility Contrast Fixes
- **Impact: 0 (perf)** / **Impact: 8 (a11y score)** | **Ease: 9** | **Visual Risk: Subtle — text slightly more visible**
- Low-contrast text fails WCAG AA. Fix:
  - `text-foreground/40` → `text-foreground/60`
  - `text-white/40` → `text-white/70`
  - `text-background/40` → `text-background/70`
- **Files:** HeroSection.tsx, AuthHeader.tsx, demo/page.tsx
- **Verify:** Text still looks subtle but is more readable. Lighthouse accessibility 95+.

---

### 15. Hero Section → Server Component + Client Islands
- **Impact: 5** | **Ease: 3** | **Visual Risk: HIGH — this caused janky loading issues**
- Split HeroSection into server-rendered text + client islands (CTAs, DashboardShowcase, FloatingIcons).
- **Why risky:** CSS entrance animations replacing Framer Motion can cause layout shifts (header resizing, image shrinking). Need careful CSS `animation-fill-mode: both` and proper sizing.
- **Recommendation:** Only do this if you can verify on mobile (375px), desktop, light/dark, and the entrance feels smooth. If it's janky, revert just this one.
- **Verify:** Refresh homepage multiple times. No header flicker, no image size jumps, no double-loading appearance.

---

### 16. ScrollReveal → FadeIn (IntersectionObserver)
- **Impact: 4** | **Ease: 3** | **Visual Risk: MEDIUM — animations feel different**
- Replace Framer Motion ScrollReveal with lightweight CSS-based FadeIn using IntersectionObserver.
- **9 components to update:** JourneySection, FeaturesGrid, StatsSection, TestimonialsSection, FAQSection, ContentShowcase, CTASection, HowItWorks, ContactSection
- **Recommendation:** Do one component at a time. Compare the scroll-reveal feel.
- **Verify:** Scroll through homepage — elements fade in smoothly. No jarky pop-in.

---

### 17. PageTransition → CSS
- **Impact: 3** | **Ease: 4** | **Visual Risk: MEDIUM — loses exit animation**
- Replace Framer Motion PageTransition (AnimatePresence) with CSS `page-enter` animation.
- **Tradeoff:** Loses exit animation (old page fading out). Entry animation preserved via CSS.
- **Verify:** Navigate between pages — transition feels smooth. No blank flash.

---

## NOT Recommended (caused user complaints)

### ~~18. Replace Hero Background Image with CSS Gradient~~
- **Impact: 6 (LCP)** | **Ease: 8** | **Visual Risk: HIGH — user noticed and disliked**
- Replaced the textured background photo with CSS radial gradients. Faster LCP but lost visual warmth.
- **Alternative:** Keep the image but add `loading="eager"` + `fetchPriority="high"` and compress it well (#1). Or use a tiny blurred placeholder.

### ~~19. Change bg-dots from Fixed to Inline~~
- **Impact: 2** | **Ease: 8** | **Visual Risk: HIGH — user noticed and disliked**
- Changed from `position: fixed` overlay to inline `background-image`. Dots now scroll with content instead of staying static.
- **Alternative:** Keep fixed dots but add `will-change: transform` to promote to compositor layer, reducing repaint cost.

---

## Recommended Order

**Start with Tier 1 (all safe, config-only):**
1. Compress images (#1)
2. Enable AVIF (#2)
3. React Compiler (#3)
4. optimizePackageImports zod (#4)
5. Remove framer-motion dupe (#5)
6. Sentry bundleSizeOptimizations (#6)

**Then Tier 2 (test each carefully):**
7. Remove Sentry from public pages (#7)
8. Split providers (#8)
9. Lazy-load below-fold sections (#9)
10. Lazy-load testimonials (#10)
11. Defer Supademo iframe (#11)
12. Lazy ScrollToTop (#12)

**Then Tier 3 (one at a time, compare feel):**
13. Composited animations (#13)
14. A11y contrast (#14)
15. Hero server component (#15) — highest risk
16. ScrollReveal → FadeIn (#16)
17. PageTransition → CSS (#17)

**Skip:** #18 (hero bg removal) and #19 (bg-dots change) unless you want them.

---

## Quick Reference

| # | Optimization | Impact | Ease | Visual Risk |
|---|-------------|--------|------|-------------|
| 1 | Compress images | 9 | 10 | None |
| 2 | AVIF format | 4 | 10 | None |
| 3 | React Compiler | 3 | 10 | None |
| 4 | Zod optimizePackageImports | 3 | 10 | None |
| 5 | Remove framer-motion dupe | 2 | 10 | None |
| 6 | Sentry bundleSizeOptimizations | 5 | 9 | None |
| 7 | Remove Sentry from public | 8 | 6 | None |
| 8 | Split providers | 7 | 5 | Low |
| 9 | Lazy below-fold sections | 6 | 6 | Low |
| 10 | Lazy testimonials | 4 | 7 | None |
| 11 | Defer Supademo iframe | 5 | 8 | Slight |
| 12 | Lazy ScrollToTop | 2 | 8 | None |
| 13 | Composited animations | 2 | 7 | Subtle |
| 14 | A11y contrast fixes | 8* | 9 | Subtle |
| 15 | Hero → server component | 5 | 3 | HIGH |
| 16 | ScrollReveal → FadeIn | 4 | 3 | MEDIUM |
| 17 | PageTransition → CSS | 3 | 4 | MEDIUM |

*A11y impact is on accessibility score, not performance score
