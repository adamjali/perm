import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  const authDisallow = [
    '/api/',           // API routes - internal only
    '/dashboard/',     // Authenticated dashboard
    '/admin/',         // Authenticated admin dashboard
    '/cases/',         // Authenticated case management (all /cases/* routes)
    '/calendar/',      // Authenticated calendar view
    '/timeline/',      // Authenticated timeline view
    '/notifications/', // Authenticated notifications
    '/settings/',      // Authenticated user settings
  ]

  return {
    rules: [
      // Allow ALL crawlers on public content; block only authenticated/app routes.
      // AI crawlers are intentionally ALLOWED for discoverability (GEO) — we WANT this
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
