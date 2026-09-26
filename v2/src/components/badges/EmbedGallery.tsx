import { Fragment } from "react";

import { CopyButton } from "@/components/badges/BadgeCatalogue";
import { EMBED_GROUP_LABEL, EMBED_SITE_DAILY_LIVE, EMBEDS, embedSnippet, type EmbedGroup } from "@/lib/embeds";

/**
 * The embed gallery on /badges: every tool another site can frame, grouped,
 * each with its snippet and a copy button, and one live specimen at the top
 * (the lookup), because a frame is easier to judge seen than described.
 *
 * Server-rendered; only the copy buttons are client code. The snippets come
 * from `embedSnippet`, the same function the tests pin, so what a reader
 * copies is what the registry says.
 */

const GROUPS: EmbedGroup[] = ["lookup", "estimate", "calculator", "chart"];

const link = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

export function EmbedGallery({ origin }: { origin: string }) {
  const lookup = EMBEDS.find((e) => e.slug === "case-status")!;
  return (
    <section id="embeds" className="mt-14 scroll-mt-24" aria-labelledby="embeds-h">
      <h2 id="embeds-h" className="font-heading text-3xl font-black">
        Embed a whole tool
      </h2>{" "}
      <p className="mt-3 max-w-3xl text-lg leading-relaxed text-foreground/70">
        Every calculator, estimate and chart on this site, and the case lookup, can sit on your page as a frame. It&apos;s
        the tool itself, so it shows the same figures as its page on the same day, with a link back.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <div className="border-2 border-border bg-card shadow-hard">
          <iframe
            src={`/embed/${lookup.slug}`}
            title={lookup.title}
            loading="lazy"
            className="block h-[30rem] w-full border-0"
          />
        </div>{" "}
        <div className="self-center">
          <p className="font-heading text-xl font-black">{lookup.title}</p>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            {lookup.blurb} It asks DOL live, up to {EMBED_SITE_DAILY_LIVE} lookups a day from each site; past that it
            answers from PERM Tracker&apos;s own record and says so under the answer.
          </p>{" "}
          <Snippet html={embedSnippet(lookup, origin)} />
        </div>
      </div>

      {GROUPS.filter((g) => g !== "lookup").map((g) => (
        <Fragment key={g}>
          {" "}
          <h3 className="mt-10 font-heading text-xl font-black">{EMBED_GROUP_LABEL[g]}</h3>{" "}
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 [&>*]:min-w-0">
            {EMBEDS.filter((e) => e.group === g).map((e) => (
              <Fragment key={e.slug}>
                {" "}
                <li className="flex flex-col border-2 border-border bg-card p-4">
                  <p className="font-heading text-base font-black">{e.title}</p>{" "}
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-foreground/80">{e.blurb}</p>{" "}
                  <p className="mt-2 text-sm">
                    <a href={`/embed/${e.slug}`} target="_blank" rel="noopener noreferrer" className={link}>
                      Preview the frame
                    </a>
                  </p>{" "}
                  <Snippet html={embedSnippet(e, origin)} />
                </li>
              </Fragment>
            ))}
          </ul>
        </Fragment>
      ))}

      <details className="mt-8 max-w-3xl border-t-2 border-border pt-4">
        <summary className="cursor-pointer list-none font-heading text-lg font-black marker:content-none">
          <span className="inline-flex min-h-11 items-center">Sizing the frame, and what it sends</span>
        </summary>
        <div className="mt-3 space-y-3 text-base leading-relaxed text-foreground/80">
          <p>
            Each snippet starts at a height that fits the tool&apos;s first view. To fit the frame to its content,
            listen for the message the frame posts whenever its height changes:{" "}
            <code translate="no" className="font-mono text-sm">
              {"{ type: \"permtracker:embed-height\", slug, height }"}
            </code>
            .
          </p>{" "}
          <p>
            Links inside a frame open in a new tab. A frame is never indexed: its search listing belongs to the full
            tool.
          </p>
        </div>
      </details>
    </section>
  );
}

function Snippet({ html }: { html: string }) {
  return (
    <div className="mt-3 flex items-start gap-2">
      <pre className="min-w-0 flex-1 overflow-x-auto border-2 border-border bg-background p-2 text-sm" translate="no">
        <code>{html}</code>
      </pre>{" "}
      <CopyButton text={html} />
    </div>
  );
}
