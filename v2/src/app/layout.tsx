import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SharedProviders } from "./shared-providers";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import {
  getSoftwareApplicationSchema,
  getOrganizationSchema,
  getWebSiteSchema,
} from "@/lib/structuredData";

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
    default: "PERM Tracker - Free Case Tracking for Immigration Attorneys",
    template: "%s | PERM Tracker",
  },
  description:
    "Free PERM case tracking software for immigration attorneys. Track deadlines, manage labor certification cases, and never miss a filing date.",
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
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  // Icons configuration - Next.js will automatically serve icon.tsx as favicon
  icons: {
    icon: [
      { url: "/icon", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "PERM Tracker",
    title: "PERM Tracker - Free Case Tracking for Immigration Attorneys",
    description:
      "Free PERM case tracking software. Track deadlines, manage cases, never miss a filing date.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "PERM Tracker - Case Management for Immigration Attorneys",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PERM Tracker - Free Case Tracking",
    description: "Free PERM case tracking for immigration attorneys.",
    images: ["/opengraph-image"],
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
      { ...software, '@id': `${baseUrl}/#software` },
      { ...org, '@id': `${baseUrl}/#organization` },
      { ...website, '@id': `${baseUrl}/#website` },
    ],
  };

  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
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
          <SharedProviders>{children}</SharedProviders>
          <SpeedInsights />
          <Analytics />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
