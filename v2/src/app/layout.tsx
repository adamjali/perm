import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SharedProviders } from "./shared-providers";
import {
  getSoftwareApplicationSchema,
  getOrganizationSchema,
  getWebSiteSchema,
  SCHEMA_IDS,
} from "@/lib/structuredData";
import { openGraphBase, socialCardImage } from "@/lib/openGraphBase";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});

// Viewport configuration for proper mobile scaling
import { PRELOADER_BOOT, PRELOADER_CSS } from "@/components/home/Preloader";
import { HomeCurtainNav } from "@/components/home/HomeCurtainNav";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#22c55e", // green-500 matching logo
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app"
  ),
  title: {
    default: "PERM Tracker - Live PERM Data and Deadline Tracking",
    template: "%s | PERM Tracker",
  },
  description:
    "Free PERM tracking for applicants and attorneys: live DOL queue data, decision estimates, and every case deadline computed automatically.",
  keywords: [
    "PERM",
    "immigration",
    "case tracking",
    "labor certification",
    "DOL",
    "immigration attorney",
    "PERM tracker",
    "deadline management",
    "ETA 9089",
    "I-140",
  ],
  authors: [{ name: "PERM Tracker" }],
  creator: "PERM Tracker",
  publisher: "PERM Tracker",
  // Emits <meta name="application-name" content="PERM Tracker">. A supporting
  // cross-signal for Google's Site Name SERP feature, alongside og:site_name +
  // WebSite JSON-LD name + <title> brand. Not Google's primary signal but
  // standard industry SEO defense-in-depth, zero-cost.
  applicationName: "PERM Tracker",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Icons. Ordered cheapest-correct first: a browser takes the first type it
  // understands, so the SVG wins everywhere modern and the PNG catches the rest.
  //
  // Two things were wrong here before 2026-08-01:
  //  - /icon.png was declared sizes:"32x32" but src/app/icon.png is 192x192, so
  //    anything asking for a 32px icon downloaded a 192px file to shrink it.
  //  - /icon-192.png was listed as a <link rel="icon">, duplicating /icon.png
  //    (identical dimensions) for a size no browser uses for a tab. The 192 and
  //    512 rasters belong to the PWA and are already declared in manifest.ts,
  //    which is the only place Android reads them from.
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    // Spread the shared base so siteName/locale/type/images stay identical to
    // every per-page override. See src/lib/openGraphBase.ts.
    ...openGraphBase,
    url: "/",
    title: "PERM Tracker - Live PERM Data and Deadline Tracking",
    description:
      "Live DOL queue data for the wait, automatic deadlines for the work. Free.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PERM Tracker - Free Case Tracking",
    description: "Live PERM data for applicants, automatic deadlines for attorneys. Free.",
    // Object form, not a bare URL string: a string emits twitter:image alone and
    // silently drops twitter:image:alt, which is what screen readers announce
    // for a shared link. url + alt only, because Twitter's card spec defines no
    // twitter:image:type/width/height, so passing the full descriptor would emit
    // three tags no consumer reads.
    images: [{ url: socialCardImage.url, alt: socialCardImage.alt }],
    creator: "@permtracker",
    site: "@permtracker",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "nYVTjXSLwwXIlF8q5qw_Jwr-kVUpVE4HDG956iRenCI",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Generate structured data for SEO (static data, not user input - safe for JSON-LD)
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
  // Strip per-schema @context — the @graph wrapper provides it once
  const { '@context': _1, ...software } = getSoftwareApplicationSchema(baseUrl);
  const { '@context': _2, ...org } = getOrganizationSchema(baseUrl);
  const { '@context': _3, ...website } = getWebSiteSchema(baseUrl);
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      { ...software, '@id': SCHEMA_IDS.software(baseUrl) },
      { ...org, '@id': SCHEMA_IDS.organization(baseUrl) },
      { ...website, '@id': SCHEMA_IDS.website(baseUrl) },
    ],
  };

  return (
    // NO auth provider here, deliberately. ConvexAuthNextjsServerProvider
    // reads the session cookies, and a cookie read in the ROOT layout makes
    // EVERY route dynamic: the whole public site was rendering ƒ with
    // no-store - revalidate ignored, a fresh server render (and its Turso
    // queries) on every visit, the blank-white first paint the preloader
    // could never cover, and the Fluid CPU bill. Convex Auth's own docs
    // scope it: "wrap the parts of your app that interact with Convex
    // functions" - which is (site)/(auth) and (authenticated), where it
    // now lives.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
        <head>
          {/*
            The home curtain's boot script, FIRST in <head>.
            It has to be here rather than beside the curtain markup: that
            markup is rendered by the home page, below this layout's header,
            so on the deployed document the header was at byte 8,339 and the
            curtain at 64,073. Any connection slow enough to paint
            incrementally showed the header and then had the curtain slam
            over it. The script gates on location.pathname so the other
            routes are untouched.
          */}
          {/*
            ABOVE the script, and inline, on purpose. The cover rule and the
            background colour it paints with both used to live in globals.css
            — an external stylesheet. WebKit paints before a pending
            stylesheet, so the script set the attribute, the browser painted
            the header, and the cover only arrived with the CSS. The
            attribute was working; there was no rule yet to act on it.
          */}
          <style dangerouslySetInnerHTML={{ __html: PRELOADER_CSS }} />
          {/*
            A RAW <script>, deliberately, not next/script.
            Verified against Next's own source (client/script.tsx +
            client/app-bootstrap.ts): in the App Router a
            `strategy="beforeInteractive"` script does NOT render as a real
            script tag. It pushes metadata onto `self.__next_s`, and
            appBootstrap creates the element later, with hydration blocked
            until that queue drains. A curtain that runs after the JS bundle
            has loaded is useless — it would paint over content the visitor
            can already see. This runs at parse time, which is the only thing
            that works here.
          */}
          <script dangerouslySetInnerHTML={{ __html: PRELOADER_BOOT }} />
          <link rel="alternate" type="application/rss+xml" title="PERM Tracker RSS Feed" href="/feed.xml" />
          {/* JSON-LD structured data for rich search results
              Note: Using dangerouslySetInnerHTML is safe here because structuredData
              is generated from hardcoded strings in structuredData.ts, not user input */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData),
            }}
          />
        </head>
        <body
          className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} font-body antialiased`}
        >
          <div className="grain-overlay" aria-hidden="true" />
          {/*
            Mounted at the ROOT, not in the public layout, because a link
            home exists in the authenticated chrome and the auth pages too.
            Renders null; it only listens.
          */}
          <HomeCurtainNav />
          <SharedProviders>{children}</SharedProviders>
          {/* Vercel Analytics + Speed Insights removed 2026-08-29: both are
              fully redundant with PostHog (autocapture pageviews + $web_vitals),
              worse on Hobby (50k-event pause, 1-month window, no custom events),
              and every beacon is an edge request this project is short of. Web
              vitals now come from PostHog capture_performance.web_vitals. */}
          {/*
            Ahrefs Web Analytics. EXTERNAL-SCRIPT form deliberately - Ahrefs
            also ships an inline injector variant, and this site's CSP is the
            reason not to use it.

            NO `integrity=` hash. Ahrefs rotates analytics.js, so a pinned
            hash would stop analytics silently on their next push, with the
            tag still sitting in the markup looking installed.
            `crossOrigin` is still correct: the host serves
            access-control-allow-origin: *.

            The CSP change in next.config.ts ships in the SAME commit and
            covers BOTH script-src (to load it) and connect-src (for the
            beacon). Widening only the first is what produces "analytics
            installed, no data" with nothing visible to diagnose.
          */}
          <script
            src="https://analytics.ahrefs.com/analytics.js"
            data-key="yvVWr0lVfhLDGM3cKrT4AA"
            crossOrigin="anonymous"
            async
          />
        </body>
      </html>
  );
}
