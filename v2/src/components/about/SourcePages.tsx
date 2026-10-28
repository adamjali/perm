import { Fragment } from "react";

import { ABOUT_DOCS } from "./aboutDocs";

/** The six federal pages and forms as one even grid, each the same shape, with its agency and page named under it. */
export function SourcePages() {
  return (
    <figure>
      <ul
        aria-label="Federal pages the site reads, and the forms a case moves through"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 [&>*]:min-w-0"
      >
        {ABOUT_DOCS.map((d) => (
          <Fragment key={d.src}>
            {" "}
            <li className="border-2 border-[var(--object-border)] bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.src}
                width={d.width}
                height={d.height}
                alt={d.alt}
                loading="lazy"
                decoding="async"
                className="block aspect-[4/3] h-auto w-full object-cover object-left-top"
              />{" "}
              <span className="block border-t-2 border-[var(--object-border)] px-2.5 py-1.5 text-sm leading-snug">
                <span className="block text-muted-foreground">{d.agency}</span>{" "}
                <span className="block font-semibold">{d.page}</span>
              </span>
            </li>
          </Fragment>
        ))}
      </ul>{" "}
      <figcaption className="mt-3 text-sm text-muted-foreground">
        The federal pages every figure here comes from, and the forms a case moves through.
      </figcaption>
    </figure>
  );
}
