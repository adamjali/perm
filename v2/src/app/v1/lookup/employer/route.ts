import { lookupEmployer } from "@/lib/api/employerLookup";
import { keylessGet, keylessOptions } from "@/lib/api/keyless";
import { cleanEmployerQuery } from "@/lib/employerNameMatch";

export const dynamic = "force-dynamic";

/**
 * GET /v1/lookup/employer?name=Acme%20Corp: the employer page a printed name
 * belongs to, and its sponsorship figures. No key: the browser extension
 * calls it (src/lib/api/keyless.ts has the limits).
 */
export const GET = keylessGet(
  "extension",
  (url) => {
    const name = cleanEmployerQuery(url.searchParams.get("name") ?? "");
    return name
      ? { ok: true, value: name }
      : { ok: false, message: "Send the employer's name, 2 to 120 characters, as ?name=." };
  },
  (name) => lookupEmployer(name),
);

export const OPTIONS = keylessOptions;
