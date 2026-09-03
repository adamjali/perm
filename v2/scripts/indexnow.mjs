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

const locs = (xml) =>
  [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim()).filter(Boolean);

const get = async (url) => {
  const r = await fetch(url, { headers: { "User-Agent": "permtracker-indexnow/1.0" } });
  if (!r.ok) throw new Error(`fetch failed: HTTP ${r.status} for ${url}`);
  return r.text();
};

/**
 * IndexNow accepts up to 10,000 URLs per request.
 * https://www.indexnow.org/documentation
 */
const BATCH = 10000;

async function main() {
  // THE SITEMAP IS AN INDEX, AND THIS USED TO SUBMIT THE INDEX ITSELF.
  //
  // `/sitemap.xml` holds five <loc> entries, and every one of them is another
  // sitemap rather than a page. So this script submitted five .xml files and
  // reported "Submitted 5 URLs" as a success, for months. Bing's IndexNow
  // report shows exactly that: the most recent submissions are
  // `sitemaps/pages.xml`, `employer-1.xml` and so on, while the last real page
  // URLs went in on 25 August, before the sitemap was split.
  //
  // A sitemap URL is a legal thing to submit and IndexNow returns 200 for it,
  // which is why nothing ever complained. It just does not tell Bing that
  // the ~13,761 individual pages exist.
  const index = await get(SITEMAP_URL);
  const entries = locs(index);
  if (entries.length === 0) throw new Error("no <loc> URLs found in sitemap");

  const children = entries.filter((u) => u.endsWith(".xml"));
  let urlList = entries.filter((u) => !u.endsWith(".xml"));
  // Per child, so an EMPTY one is caught. A child that fails at the HTTP level
  // already throws inside get(); one that answers 200 with no <loc> entries
  // does not, and the total floor below cannot see it: dropping both employer
  // sitemaps (5,000 + 4,646) still leaves 4,115, which sails past `< 100` and
  // reports success over a walk that lost two thirds of the site. Measured
  // 2026-09-03 against the live sitemap, which is what named this gap.
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

  // And a total floor, for the case where the INDEX itself came back thin.
  // Kept deliberately loose: it is the backstop, not the real check above.
  if (urlList.length < 100) {
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
