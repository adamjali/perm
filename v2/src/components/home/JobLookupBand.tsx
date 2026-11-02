import Link from "next/link";

import { SocCodeSummary } from "@/components/soc/SocCodeSummary";
import { socProfile } from "@/lib/db/socProfile";
import { getSocCodes } from "@/lib/db/socTitles";
import { JobLookupBox } from "./JobLookupBox";

/**
 * "What does DOL call this job?": a job title box beside one real code's card, the busiest PERM code in DOL's
 * files, drawn from the same profile the signed-in case form shows (lib/db/socProfile.ts). For the person
 * hiring (what to call the role, what it pays), the person preparing the case (the code and its description)
 * and the worker (what the job usually involves), as Sabrina put it on Nov 1 2026.
 *
 * A failed read drops the specimen and keeps the box; nothing here is typed by hand.
 */
export async function JobLookupBand() {
  const specimen = await busiestCodeProfile().catch((e: unknown) => {
    console.warn("[home] the job code specimen is unreadable", e);
    return null;
  });
  return (
    <section aria-labelledby="job-lookup-heading" className="border-b-3 border-border bg-background">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-12 [&>*]:min-w-0">
        <div>
          <h2 id="job-lookup-heading" className="font-heading text-2xl font-bold sm:text-3xl">
            What does DOL call this job?
          </h2>{" "}
          <p className="mt-2 max-w-xl text-base text-soft">
            Type a job title. The codes come ranked by how often employers filed that title under each, with the pay and
            how often DOL approves it.
          </p>{" "}
          <JobLookupBox />{" "}
          <p className="mt-4 text-sm text-soft">
            Preparing a case?{" "}
            <Link href="/for-attorneys#job-code" className="link">
              The case app suggests the code and a job description
            </Link>
            .
          </p>
        </div>{" "}
        {specimen ? (
          <figure className="m-0">
            <SocCodeSummary profile={specimen} className="shadow-hard" newTab={false} />
            <figcaption className="mt-3 text-sm text-soft">
              The busiest job in DOL&apos;s PERM files, from DOL&apos;s files and O*NET.
            </figcaption>
          </figure>
        ) : null}
      </div>
    </section>
  );
}

/** The code with the most PERM filings, read whole. */
async function busiestCodeProfile() {
  const codes = await getSocCodes();
  if (!codes) return null;
  let top: string | null = null;
  let most = 0;
  for (const c of codes.codes.values()) {
    if (c.perm > most) {
      most = c.perm;
      top = c.soc;
    }
  }
  return top ? socProfile(top) : null;
}
