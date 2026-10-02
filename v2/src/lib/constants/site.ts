/**
 * The site's own address, for absolute URLs: canonical links, structured
 * data, feeds and sitemaps. Local builds set NEXT_PUBLIC_APP_URL to their own
 * host so those URLs resolve on the machine that built them.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";
