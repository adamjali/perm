#!/usr/bin/env node
/**
 * IndexNow submitter: pings IndexNow (Bing, Yandex, Seznam and others) with every
 * public URL in the sitemap so they recrawl fast instead of waiting weeks.
 *
 * Bing's index feeds several AI search products, so keeping it fresh is the
 * cheapest way to be current in AI answers. Runs after every production deploy
 * (.github/workflows/indexnow.yml).
 *
 * Usage:   node scripts/indexnow.mjs
 * Requires the ownership key file to be live first:
 *          https://<host>/387bc5d78cc17c7049731cf74644a70e.txt
 */

const HOST = process.env.INDEXNOW_HOST || "permtracker.app";
const KEY = process.env.INDEXNOW_KEY || "387bc5d78cc17c7049731cf74644a70e";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const SITEMAP_URL = `https://${HOST}/sitemap.xml`;

const locs = (xml) =>
  [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim()).filter(Boolean);

// Waits before each retry of a sitemap the server could not answer, as it can
// for a moment while a fresh deploy warms. An error that persists across every
// attempt still fails the run, so a real outage stays loud.
const RETRY_WAITS_MS = (process.env.INDEXNOW_RETRY_WAITS_MS || "5000,15000,30000")
  .split(",")
  .map(Number);

const get = async (url) => {
  // Only sitemaps are fetched here, and any client may read them, so this
  // needs no audit key.
  for (let attempt = 0; ; attempt++) {
    let why;
    try {
      const r = await fetch(url, { headers: { "User-Agent": "permtracker-indexnow/1.0" } });
      if (r.ok) return r.text();
      why = `HTTP ${r.status}`;
      // A 4xx other than 429 is our mistake or a missing file: retrying cannot help.
      if (r.status < 500 && r.status !== 429) throw new Error(`fetch failed: ${why} for ${url}`);
    } catch (e) {
      if (String(e.message).startsWith("fetch failed:")) throw e;
      why = e.message; // network error: worth another try
    }
    if (attempt >= RETRY_WAITS_MS.length) throw new Error(`fetch failed: ${why} for ${url} (after ${attempt + 1} attempts)`);
    console.log(`  ${url}: ${why}, retrying in ${RETRY_WAITS_MS[attempt] / 1000}s`);
    await new Promise((res) => setTimeout(res, RETRY_WAITS_MS[attempt]));
  }
};

/**
 * IndexNow accepts up to 10,000 URLs per request.
 * https://www.indexnow.org/documentation
 */
const BATCH = 10000;
// The site has far more pages than this; fewer means the walk itself broke.
const MIN_URLS = 100;

async function main() {
  // `/sitemap.xml` is a sitemap INDEX: its entries are child sitemaps, not
  // pages. IndexNow accepts a sitemap URL with a 200 and learns nothing from
  // it, so the pages are read out of every child.
  const index = await get(SITEMAP_URL);
  const entries = locs(index);
  if (entries.length === 0) throw new Error("no <loc> URLs found in sitemap");

  const children = entries.filter((u) => u.endsWith(".xml"));
  let urlList = entries.filter((u) => !u.endsWith(".xml"));
  // Per child, so an empty one is caught: a child answering 200 with no
  // <loc> entries would otherwise pass the total floor below while most of
  // the site went unsubmitted.
  for (const child of children) {
    const found = locs(await get(child));
    if (found.length === 0) {
      throw new Error(
        `child sitemap ${child} returned 200 with no <loc> entries; ` +
          "refusing to submit a partial walk",
      );
    }
    console.log(`  ${child}: ${found.length} URLs`);
    urlList = urlList.concat(found);
  }
  urlList = [...new Set(urlList)];

  // A total floor, for an index that itself came back thin.
  if (urlList.length < MIN_URLS) {
    throw new Error(
      `only ${urlList.length} page URLs found across ${children.length} child sitemaps; ` +
        "refusing to report success over a broken walk",
    );
  }
  console.log(
    `Found ${urlList.length} page URLs across ${children.length} child sitemap(s) for ${HOST}`,
  );

  let sent = 0;
  for (let i = 0; i < urlList.length; i += BATCH) {
    const batch = urlList.slice(i, i + BATCH);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: batch }),
    });
    // IndexNow: 200/202 = accepted; 422 = key/URL mismatch; 403 = key not validated yet.
    console.log(`  batch ${i / BATCH + 1}: ${batch.length} URLs -> HTTP ${res.status} ${res.statusText}`);
    if (res.status !== 200 && res.status !== 202) {
      const body = await res.text().catch(() => "");
      console.error("Response body:", body.slice(0, 500));
      console.error("Tip: ensure the key file is live (deployed) at", KEY_LOCATION);
      process.exit(1);
    }
    sent += batch.length;
  }
  console.log(`✓ Accepted. Submitted ${sent} page URLs.`);
}

main().catch((err) => {
  console.error("IndexNow error:", err.message);
  process.exit(1);
});
