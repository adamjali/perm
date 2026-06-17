#!/usr/bin/env node
/**
 * IndexNow submitter — pings IndexNow (Bing, Yandex, Seznam, et al.) with every
 * public URL in the sitemap so they recrawl fast instead of waiting weeks.
 *
 * Why this matters for GEO: Bing's index feeds ChatGPT Search and Perplexity, so
 * keeping Bing fresh is the cheapest lever for getting surfaced in AI answers.
 *
 * Usage:   node scripts/indexnow.mjs
 * Requires the ownership key file to be live first:
 *          https://<host>/387bc5d78cc17c7049731cf74644a70e.txt
 *
 * Optional: wire into CI (e.g. a GitHub Action on content changes) for full automation.
 */

const HOST = process.env.INDEXNOW_HOST || "permtracker.app";
const KEY = process.env.INDEXNOW_KEY || "387bc5d78cc17c7049731cf74644a70e";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;

async function main() {
  const sm = await fetch(SITEMAP_URL, {
    headers: { "User-Agent": "permtracker-indexnow/1.0" },
  });
  if (!sm.ok) throw new Error(`sitemap fetch failed: HTTP ${sm.status}`);
  const xml = await sm.text();

  const urlList = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  if (urlList.length === 0) throw new Error("no <loc> URLs found in sitemap");

  console.log(`Submitting ${urlList.length} URLs to IndexNow for ${HOST} …`);

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
  });

  // IndexNow: 200/202 = accepted; 422 = key/URL mismatch; 403 = key not validated yet.
  console.log(`IndexNow response: HTTP ${res.status} ${res.statusText}`);
  if (res.status !== 200 && res.status !== 202) {
    const body = await res.text().catch(() => "");
    console.error("Response body:", body.slice(0, 500));
    console.error(
      "Tip: ensure the key file is live (deployed) at",
      KEY_LOCATION,
      "before submitting.",
    );
    process.exit(1);
  }
  console.log(`✓ Accepted. Submitted ${urlList.length} URLs.`);
}

main().catch((err) => {
  console.error("IndexNow error:", err.message);
  process.exit(1);
});
