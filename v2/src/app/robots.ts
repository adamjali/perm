import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  // A robots.txt path is a PREFIX match, so '/admin' covers '/admin', '/admin/'
  // and '/admin/security' alike. These used to carry trailing slashes, which do
  // NOT match the bare path: '/admin/' never blocked '/admin'. Googlebot crawled
  // both '/admin' and '/dashboard' and filed them in Search Console as indexing
  // errors. Nothing leaked (they 307 to /login, which is noindex), but it spent
  // crawl budget on routes that can never be served to a crawler.
  //
  // The prefix semantics cut both ways: a future public page at '/settings-guide'
  // or '/timeline-explained' would be silently blocked by the entries below.
  // Check this list before adding a public route that starts with one of them.
  const authDisallow = [
    '/api',           // API routes - internal only
    '/dashboard',     // Authenticated dashboard
    '/admin',         // Authenticated admin dashboard
    '/cases',         // Authenticated case management (all /cases/* routes)
    '/calendar',      // Authenticated calendar view
    '/timeline',      // Authenticated timeline view
    '/notifications', // Authenticated notifications
    '/settings',      // Authenticated user settings
  ]

  return {
    rules: [
      // Allow ALL crawlers on public content; block only authenticated/app routes.
      // AI crawlers are intentionally ALLOWED for discoverability (GEO): we WANT this
      // product surfaced in AI search/answers (ChatGPT, Claude, Perplexity, Gemini) and
      // in training corpora that feed them. Public pages are marketing/educational content
      // meant to be found; the actual app stays behind auth (authDisallow) + BotID.
      // Covers search + training bots alike: GPTBot, ChatGPT-User, OAI-SearchBot,
      // ClaudeBot, anthropic-ai, Google-Extended, PerplexityBot, CCBot, Amazonbot, etc.
      {
        userAgent: '*',
        allow: '/',
        disallow: authDisallow,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
