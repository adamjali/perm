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
      // Default rule: allow public content, block authenticated routes
      // AI search bots (ClaudeBot, OAI-SearchBot, PerplexityBot, ChatGPT-User,
      // Amazonbot) inherit from this wildcard — no separate rules needed
      {
        userAgent: '*',
        allow: '/',
        disallow: authDisallow,
      },
      // Block AI training crawlers (protect content from model training datasets)
      { userAgent: 'GPTBot', disallow: '/' },
      { userAgent: 'anthropic-ai', disallow: '/' },
      { userAgent: 'Google-Extended', disallow: '/' },
      { userAgent: 'CCBot', disallow: '/' },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
