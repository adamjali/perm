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
import { Preloader, PRELOADER_BOOT, PRELOADER_CSS } from "@/components/home/Preloader";
import { SITE_URL } from "@/lib/constants/site";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#22c55e", // green-500 matching logo
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  // Two rules:
  //  - a declared size must match the file: src/app/icon.png is 192x192, so
  //    declaring it 32x32 makes anything asking for a 32px icon download a
  //    192px file to shrink it.
  //  - no /icon-192.png <link rel="icon">: it duplicates /icon.png (identical
  //    dimensions) for a size no browser uses for a tab. The 192 and 512
  //    rasters belong to the PWA and are declared in manifest.ts, which is
  //    the only place Android reads them from.
  icons: {
    icon: [
      // DECLARED SIZES, because the file genuinely holds three frames and we
      // were advertising the smallest. favicon.ico contains 16, 32 AND 48px
      // (verified by reading its ICONDIR: 2,878 bytes, 3 images), but while it
      // lived at src/app/favicon.ico the Next file convention emitted
      // `sizes="16x16"` for it - so the largest size Google was ever TOLD about
      // was 16, against a documented recommendation of larger than 48x48. It
      // moved to public/ purely so this declaration is ours to make.
      { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
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
  const baseUrl = SITE_URL;
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
    // EVERY route dynamic: the whole public site renders ƒ with no-store -
    // revalidate ignored, a fresh server render (and its database queries)
    // on every visit, and a blank-white first paint the preloader can never
    // cover. Convex Auth's own docs scope it: "wrap the parts of your app
    // that interact with Convex functions" - which is (site)/(auth) and
    // (authenticated), where it lives.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
        <head>
          {/*
            The home curtain: its CSS and boot script FIRST in <head>, inline,
            so the rules exist before anything paints (WebKit paints before a
            pending external stylesheet). The script gates on
            location.pathname, so other routes are untouched. The panel itself
            is the first child of <body> below. See Preloader.tsx.
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
          {/*
            The home curtain's panel, FIRST in <body> on every route so it
            paints in the same frame as the header it covers. Hidden unless
            the boot script arms it (hard loads of "/" only).
          */}
          <Preloader />
          <div className="grain-overlay" aria-hidden="true" />
          <SharedProviders>{children}</SharedProviders>
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
