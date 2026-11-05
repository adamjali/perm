/**
 * One US consulate: the month NVC is scheduling in each category at every State update held, and
 * the immigrant visas the post issued each month, from State's two tables (see the index page).
 * The interview pause is the hand-kept record, dated. Under State's figures, "What people report": visitors'
 * own interview reports (convex/consularReports.ts), labelled self-reported at every figure, with the form.
 *
 * Expired with the index by /api/revalidate-consular.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOutIcon, BriefcaseIcon, HeartIcon, MegaphoneSimpleIcon, UsersThreeIcon } from "@phosphor-icons/react/ssr";

import { api } from "@convex/_generated/api";
import { ConsularPauseNote } from "@/components/consular/ConsularPauseNote";
import { WorkVisasAtPost } from "@/components/consular/WorkVisasAtPost";
import { ConsularReports } from "@/components/consular/ConsularReports";
import { DataProvenance } from "@/components/data/DataProvenance";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { FinePrint } from "@/components/data/FinePrint";
import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { breadcrumbSchema } from "@/lib/breadcrumbs";
import { queryStatic } from "@/lib/convexStatic";
import { softFail } from "@/lib/softRead";
import { behindLabel, IV_CATEGORIES, IV_CATEGORY_LABEL, IV_TOOL_URL, monthsBehind, type IvCategory } from "@/lib/consular/scheduling";
import { embassyVisasUrl, shortExcerpt } from "@/lib/consular/embassies";
import { getConsularIndex, getEmbassyNotices, getPostDetail, type EmbassyNotices, type PostDetail } from "@/lib/db/consularPosts";
import { EMPLOYMENT_CATEGORIES, monthName } from "@/lib/db/visaIssuances";
import { formatInt } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { longDate, monthTick, shiftMonth, shortDate } from "@convex/lib/months";

export const revalidate = 86400;

/** The busiest posts are built ahead; the rest render on their first visit. */
export async function generateStaticParams() {
  try {
    const { posts } = await getConsularIndex();
    return [...posts].sort((a, b) => b.employment - a.employment).slice(0, 30).map((p) => ({ post: p.slug }));
  } catch {
    return [];
  }
}

const titleOf = (name: string) => `${name}: Immigrant Visas and NVC Scheduling`;
const descriptionOf = (name: string) =>
  `Where the US consulate in ${name} stands: the month NVC is scheduling for interviews, the immigrant visas it issued each month, and the interview pause.`;

export async function generateMetadata({ params }: { params: Promise<{ post: string }> }): Promise<Metadata> {
  const { post: slug } = await params;
  const post = (await getConsularIndex()).posts.find((p) => p.slug === slug);
  if (!post) notFound();
  const path = `/consular-posts/${post.slug}`;
  return withSocialCard(
    {
      title: titleOf(post.name),
      description: descriptionOf(post.name),
      alternates: { canonical: path },
      openGraph: { ...openGraphBase, title: `${titleOf(post.name)} | PERM Tracker`, description: descriptionOf(post.name), url: path },
    },
    "consular-posts",
  );
}

const ICON: Record<IvCategory, typeof BriefcaseIcon> = { employment: BriefcaseIcon, family: UsersThreeIcon, immediate: HeartIcon };

/** One column per State update: how many months back the post was scheduling. */
function behindColumns(post: PostDetail, cat: IvCategory): Column[] {
  const last = post.history.length - 1;
  return post.history.map((r, i) => {
    const n = monthsBehind(r.cells[cat], r.asOf);
    return {
      key: r.asOf,
      value: n ?? 0,
      gap: n === null,
      now: i === last,
      label: shortDate(r.asOf) ?? r.asOf,
      tip: `${IV_CATEGORY_LABEL[cat]}, State's update of ${shortDate(r.asOf)}\nScheduling cases complete in ${r.cells[cat].printed || "no month shown"}\n${behindLabel(r.cells[cat], r.asOf)}`,
    };
  });
}

const FAMILY = new Set(["Immediate relatives", "Family preferences"]);
const EMPLOYMENT = new Set<string>(EMPLOYMENT_CATEGORIES);

/** One stacked column a month: employment visas at the foot, family above, the rest on top. */
function issuedColumns(post: PostDetail, to: string | null): Column[] {
  if (!to || !post.months.length) return [];
  const have = new Map(post.months.map((m) => [m.month, m.byCategory]));
  const first = post.months[0]!.month;
  const out: Column[] = [];
  for (let m = first; m <= to; m = shiftMonth(m, 1)) {
    const cats = have.get(m);
    if (!cats) {
      out.push({ key: m, value: 0, gap: true, label: monthName(m), tip: `${monthName(m)}\nNo table for this month` });
      continue;
    }
    let eb = 0;
    let fam = 0;
    let other = 0;
    for (const [c, n] of Object.entries(cats)) {
      if (EMPLOYMENT.has(c)) eb += n;
      else if (FAMILY.has(c)) fam += n;
      else other += n;
    }
    out.push({
      key: m,
      value: eb + fam + other,
      label: monthName(m),
      parts: [
        { value: eb, fill: "bg-primary" },
        { value: fam, fill: "bg-chart-blue" },
        { value: other, fill: "bg-chart-yellow" },
      ],
      tip: `${monthName(m)}\n${formatInt(eb)} employment\n${formatInt(fam)} family\n${formatInt(other)} other`,
    });
  }
  return out;
}

export default async function ConsularPostPage({ params }: { params: Promise<{ post: string }> }) {
  const { post: slug } = await params;
  const [post, index] = await Promise.all([getPostDetail(slug), getConsularIndex()]);
  if (!post) notFound();
  // Visitors' own reports (convex/consularReports.ts): a page that can't read them still renders State's figures.
  const [embassy, reports, everyPost] = await Promise.all([
    getEmbassyNotices(post.key),
    queryStatic(api.consularReports.forPost, { post: post.slug }, revalidate).catch(softFail("consular-posts/post.reports", null)),
    queryStatic(api.consularReports.overview, {}, revalidate).catch(softFail("consular-posts/post.overview", null)),
  ]);
  const path = `/consular-posts/${post.slug}`;
  const asOf = index.asOf;
  const now = post.now;
  const issued = issuedColumns(post, index.issuedTo);
  const charted = post.history.length > 1;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <JsonLdScript schema={breadcrumbSchema(path, post.name)} />
      <div className="pt-10 sm:pt-12" />
      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">{post.name}: immigrant visas</h1>{" "}
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          {post.issued > 0 && index.issuedFrom && index.issuedTo ? (
            <>
              The consulate in {post.name} issued{" "}
              <span className="font-heading font-bold tabular-nums text-foreground">{formatInt(post.issued)}</span> immigrant
              visas from {monthName(index.issuedFrom)} to {monthName(index.issuedTo)}, {formatInt(post.employment)} of them
              employment-based.
            </>
          ) : (
            <>State&apos;s monthly tables show no immigrant visas issued in {post.name} in the newest 12 months they cover.</>
          )}
        </p>
      </header>

      <ConsularPauseNote className="mt-6 max-w-4xl" />

      {now && asOf ? (
        <FigureRow className="mt-8">
          {IV_CATEGORIES.map((c) => {
            const Icon = ICON[c];
            return (
              <Figure
                key={c}
                icon={<Icon aria-hidden="true" weight="bold" className="size-4" />}
                label={`${IV_CATEGORY_LABEL[c]} cases`}
                value={now[c].printed || "Not shown"}
                note={`${behindLabel(now[c], asOf)}, State's update of ${longDate(asOf)}`}
              />
            );
          })}
        </FigureRow>
      ) : (
        <p className="mt-8 max-w-3xl text-base text-muted-foreground">
          State&apos;s scheduling table doesn&apos;t list {post.name}.
        </p>
      )}

      {embassy ? <EmbassyNoticeList data={embassy} /> : null}

      {charted ? (
        <FigurePlate
          title="How far back NVC was scheduling, update by update"
          subject={`State's updates of ${shortDate(post.history[0]!.asOf)} to ${shortDate(post.history.at(-1)!.asOf)}`}
          caption="Each column is one of State's monthly updates: how many months before it the cases NVC was scheduling were completed. No column means the post had no backlog on paper. The newest is lime. A dashed outline is an update with no month shown."
          source="U.S. Department of State, IV Scheduling Status Tool"
          className="mt-10"
        >
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3 [&>*]:min-w-0">
            {IV_CATEGORIES.map((c) => (
              <div key={c}>
                <p className="font-heading text-lg font-bold">{IV_CATEGORY_LABEL[c]}</p>{" "}
                <ColumnChart
                  columns={behindColumns(post, c)}
                  label={`${post.name}, ${IV_CATEGORY_LABEL[c]}: months back NVC was scheduling at each update`}
                  first={shortDate(post.history[0]!.asOf) ?? ""}
                  last={shortDate(post.history.at(-1)!.asOf) ?? ""}
                  unit="months back"
                  className="mt-3"
                  gapKey="No month shown"
                />
              </div>
            ))}
          </div>
        </FigurePlate>
      ) : null}

      {issued.length ? (
        <FigurePlate
          title="Immigrant visas issued each month"
          subject={`${monthName(issued[0]!.key)} to ${monthName(issued.at(-1)!.key)}`}
          caption="Each column is one month at this consulate: employment visas in lime at the foot, family in blue, everything else in yellow. A dashed outline is a month State's tables don't cover. State posts each month months late."
          source="U.S. Department of State, monthly immigrant visa issuances by post"
          className="mt-10"
        >
          <ColumnChart
            columns={issued}
            label={`Immigrant visas issued in ${post.name} each month`}
            first={monthTick(issued[0]!.key) ?? ""}
            last={monthTick(issued.at(-1)!.key) ?? ""}
            unit="visas"
            gapKey="No table for this month"
          />
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Colour key">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3 bg-primary" /> Employment
            </li>{" "}
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3 bg-chart-blue" /> Family (immediate relatives and preferences)
            </li>{" "}
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3 bg-chart-yellow" /> Everything else
            </li>
          </ul>
        </FigurePlate>
      ) : null}

      <WorkVisasAtPost postKey={post.key} name={post.name} className="mt-12" />

      <FinePrint summary="How to read State's scheduling month" className="mt-8">
        <p className="max-w-3xl text-base leading-relaxed">
          State says the tool shows{" "}
          <q>
            the documentarily complete month and year for which NVC is scheduling most interviews in your classification
            at the selected U.S. embassy or consulate.
          </q>{" "}
          If your case became documentarily complete before the month shown, NVC is scheduling cases like yours here. A
          preference case also needs a current priority date in the{" "}
          <Link href="/visa-bulletin" className="link">
            visa bulletin
          </Link>
          . It&apos;s NVC&apos;s paperwork queue, so it doesn&apos;t say whether the post is holding interviews.
        </p>
      </FinePrint>

      <p className="mt-6 text-sm text-muted-foreground">
        Sources:{" "}
        <a href={IV_TOOL_URL} className="link" target="_blank" rel="noopener noreferrer">
          U.S. Department of State, IV Scheduling Status Tool
        </a>
        {asOf ? `, update of ${longDate(asOf)}` : ""}, and its monthly immigrant visa issuances by post
        {index.issuedTo ? ` through ${monthName(index.issuedTo)}` : ""}.
      </p>

      <ConsularReports
        name={post.name}
        post={post.slug}
        view={reports}
        all={everyPost?.all ?? null}
        className="mt-12 border-t-2 border-border pt-10"
      />

      <ToolPageFooter
        currentHref={path}
        reading={[
          { href: "/consular-posts", label: "Every consulate", note: "where each post stands" },
          { href: "/guides/immigrant-visa-interview-pause", label: "The interview pause, explained", note: "what changed and who it reaches" },
          { href: "/visa-issuances", label: "Visas issued abroad", note: "every category, month by month" },
        ]}
      />
      <DataProvenance
        datasets={
          embassy
            ? ["iv-scheduling", "visa-issuances", "niv-issuances", "policy-notices-embassies"]
            : ["iv-scheduling", "visa-issuances", "niv-issuances"]
        }
      />
    </div>
  );
}

/**
 * The embassy's own visa notices: what it posted about its operations, newest first, linked to its own post. The
 * hand-kept pause record above says what State filed in court; these are what the embassy told its applicants.
 */
function EmbassyNoticeList({ data }: { data: EmbassyNotices }) {
  const { embassy, notices } = data;
  const own = embassyVisasUrl(embassy);
  return (
    <section aria-labelledby="embassy-notices" className="mt-10 max-w-4xl">
      <h2 id="embassy-notices" className="flex items-center gap-2 font-heading text-2xl font-bold">
        <MegaphoneSimpleIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" /> From the {embassy.name}
      </h2>{" "}
      {notices.length ? (
        <>
          <p className="mt-2 text-base text-muted-foreground">
            Its own notices on consular operations and immigrant visas, newest first, as the embassy posted them.
          </p>{" "}
          <ol className="mt-4 divide-y-2 divide-border border-y-2 border-border">
            {notices.map((n) => (
              <li key={n.url} className="py-4">
                <p className="text-sm font-semibold tabular-nums text-muted-foreground">{longDate(n.day) ?? n.day}</p>{" "}
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="link inline-flex min-h-11 items-center font-heading text-lg font-bold">
                  {n.title}
                </a>{" "}
                {n.excerpt ? <p className="mt-1 max-w-3xl text-base leading-relaxed">{shortExcerpt(n.excerpt)}</p> : null}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="mt-2 text-base text-muted-foreground">
          The embassy hasn&apos;t posted a notice on consular operations or immigrant visas in the last year that this site
          has read.
        </p>
      )}{" "}
      <a
        href={own}
        target="_blank"
        rel="noopener noreferrer"
        className="link mt-4 inline-flex min-h-11 items-center gap-2 text-base"
      >
        Every visa post on the embassy&apos;s own site <ArrowSquareOutIcon aria-hidden="true" className="size-4" />
      </a>
    </section>
  );
}
