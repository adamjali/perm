import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getLocale } from "next-intl/server";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ConvexClientProvider } from "./providers";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";

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
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get locale and messages for i18n
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <ConvexAuthNextjsServerProvider>
      <html lang={locale} suppressHydrationWarning>
        <body
          className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} font-body antialiased`}
        >
          <div className="grain-overlay" aria-hidden="true" />
          <NextIntlClientProvider messages={messages}>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </NextIntlClientProvider>
          <SpeedInsights />
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
