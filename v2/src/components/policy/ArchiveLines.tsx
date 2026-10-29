"use client";

/**
 * One year's folded archive lines: the document's id, its day and source, its
 * address and its title. A client component on purpose: its rows travel to the
 * browser as four short strings each, where a server component's markup would
 * travel a second time in the page's payload (about 1,000 rows on
 * /policy-changes). Every title is still in the served HTML.
 */
export type ArchiveLine = readonly [id: string, day: string, url: string, title: string];

export function ArchiveLines({ lines }: { lines: readonly ArchiveLine[] }) {
  return (
    <ul className="border-t-2 border-border/40 px-5 pb-4 pt-3 text-base leading-relaxed sm:px-6">
      {lines.map(([id, day, url, title]) => (
        <li key={id} id={`doc-${id}`} className="doc-line">
          <span className="doc-day">{day}</span>{" "}
          <a href={url} rel="noopener" target="_blank" className="link doc-a">
            {title}
          </a>{" "}
        </li>
      ))}
    </ul>
  );
}
