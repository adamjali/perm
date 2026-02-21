import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://permtracker.app'

  const authDisallow = [
    '/api/',           // API routes - internal only
    '/dashboard/',     // Authenticated dashboard
    '/cases/',         // Authenticated case management (all /cases/* routes)
    '/calendar/',      // Authenticated calendar view
    '/timeline/',      // Authenticated timeline view
    '/notifications/', // Authenticated notifications
    '/settings/',      // Authenticated user settings
  ]

  return {
    rules: [
      // Default rule for all crawlers
      {
        userAgent: '*',
        allow: '/',
        disallow: authDisallow,
      },
      // Explicitly allow AI search crawlers (public content only)
      {
        userAgent: 'GPTBot',
        allow: '/',
        disallow: authDisallow,
      },
      {
        userAgent: 'OAI-SearchBot',
        allow: '/',
        disallow: authDisallow,
      },
      {
        userAgent: 'ChatGPT-User',
        allow: '/',
        disallow: authDisallow,
      },
      {
        userAgent: 'ClaudeBot',
        allow: '/',
        disallow: authDisallow,
      },
      {
        userAgent: 'PerplexityBot',
        allow: '/',
        disallow: authDisallow,
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: authDisallow,
      },
      {
        userAgent: 'Amazonbot',
        allow: '/',
        disallow: authDisallow,
      },
      {
        userAgent: 'anthropic-ai',
        allow: '/',
        disallow: authDisallow,
      },
      {
        userAgent: 'cohere-ai',
        allow: '/',
        disallow: authDisallow,
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
