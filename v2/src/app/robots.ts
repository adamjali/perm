import type { MetadataRoute } from 'next'
import { SITE_URL } from "@/lib/constants/site";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = SITE_URL

  // A robots.txt path is a PREFIX match, so '/admin' covers '/admin', '/admin/'
  // and '/admin/security' alike. No trailing slashes: '/admin/' does NOT match
  // the bare path, so it never blocks '/admin', and Googlebot would crawl
  // '/admin' and '/dashboard' and file them in Search Console as indexing
  // errors. Nothing would leak (they 307 to /login, which is noindex), but it
  // spends crawl budget on routes that can never be served to a crawler.
  //
  // The prefix semantics cut both ways: a future public page at '/settings-guide'
  // or '/timeline-explained' would be silently blocked by the entries below.
  // Check this list before adding a public route that starts with one of them.
  const authDisallow = [
    '/api',           // API routes - internal only
    // The public API and the MCP server answer programs, not readers; /developers
    // documents them and is the page to index.
    '/v1',
    '/mcp',
    '/dashboard',     // Authenticated dashboard
    '/admin',         // Authenticated admin dashboard
    '/cases',         // Authenticated case management (all /cases/* routes)
    '/calendar',      // Authenticated calendar view
    '/timeline',      // Authenticated timeline view
    '/notifications', // Authenticated notifications
    '/settings',      // Authenticated user settings
    // The lookup page is indexable; its query-string variants are not worth a
    // crawl. Every case number on the site links to one, each is a dynamic
    // render that can ask DOL live, and a crawler walking thousands of them is
    // pure cost, in database reads and DOL requests.
    '/perm-case-status?',
    // The embedded lookup asks DOL live on every query (under a daily cap per
    // embedding site), so its query variants are the same cost, and worse.
    '/embed/case-status?',
    // A pair of employers is a dynamic render per request, and the number of
    // pairs is the square of the employer count.
    '/perm-employers/compare?',
  ]

  // High-volume crawlers that bring this product NOTHING back. Human
  // pageviews are a small fraction of all requests; the rest is bots working
  // the sitemap. Search bots (Google, Bing, DuckDuckGo, Apple) and AI
  // bots (GPTBot, ClaudeBot, Perplexity, CCBot, ...) stay welcome: they are
  // the distribution strategy. Ahrefs stays: it is our own audit tool. The
  // ones below are SEO-index and scraper fleets whose data nobody here
  // consumes - each obeys robots.txt, and each can re-earn access the day
  // it is useful. Bytespider is not on it: it is ByteDance's AI-training
  // crawler, and the policy above says AI crawlers are welcome. robots.txt is
  // advisory, so this trims the polite high-volume tail rather than
  // "securing" anything.
  const freeloaders = [
    'SemrushBot',
    'MJ12bot',
    'DotBot',
    'BLEXBot',
    'PetalBot',
    'DataForSeoBot',
    'serpstatbot',
    'ZoominfoBot',
    'MegaIndex.ru',
    'Barkrowler',
    'SeekportBot',
  ]

  return {
    rules: [
      // Allow ALL crawlers on public content; block only authenticated/app routes.
      // AI crawlers are intentionally ALLOWED for discoverability (GEO): we WANT this
      // product surfaced in AI search/answers (ChatGPT, Claude, Perplexity, Gemini) and
      // in training corpora that feed them. Public pages are marketing/educational content
      // meant to be found; the actual app stays behind auth (authDisallow).
      // Covers search + training bots alike: GPTBot, ChatGPT-User, OAI-SearchBot,
      // ClaudeBot, anthropic-ai, Google-Extended, PerplexityBot, CCBot, Amazonbot, etc.
      {
        userAgent: '*',
        allow: '/',
        disallow: authDisallow,
      },
      ...freeloaders.map((bot) => ({ userAgent: bot, disallow: '/' })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
