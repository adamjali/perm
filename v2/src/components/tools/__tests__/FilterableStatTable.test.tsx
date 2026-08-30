import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  FilterableStatTable,
  type Facet,
  type StatColumn,
} from "../FilterableStatTable";

interface Row {
  name: string;
  total: number;
  state: string | null;
  /** Nullable on purpose: "no data" must not sort as a low number. */
  days: number | null;
}

const COLUMNS: StatColumn<Row>[] = [
  { key: "name", label: "Name", sortValue: (r) => r.name, render: (r) => r.name },
  {
    key: "total",
    label: "Total",
    numeric: true,
    sortValue: (r) => r.total,
    render: (r) => String(r.total),
  },
  {
    key: "days",
    label: "Days",
    numeric: true,
    sortValue: (r) => r.days,
    render: (r) => (r.days == null ? "—" : String(r.days)),
  },
];

const STATE_FACET: Facet<Row> = {
  key: "state",
  label: "State",
  value: (r) => r.state,
};

const ROWS: Row[] = [
  { name: "Amazon", total: 300, state: "WA", days: 410 },
  { name: "Google", total: 900, state: "CA", days: null },
  { name: "Microsoft", total: 600, state: "WA", days: 380 },
];

function base() {
  return {
    columns: COLUMNS,
    searchText: (r: Row) => r.name,
    searchPlaceholder: "Find…",
    initialSort: "total",
    caption: "test table",
    noun: "employers",
  };
}

function bodyOrder(): string[] {
  return screen
    .getAllByRole("row")
    .slice(1) // header
    .map((tr) => tr.textContent ?? "");
}

describe("FilterableStatTable", () => {
  it("sorts by the initial column, descending", () => {
    render(<FilterableStatTable rows={ROWS} {...base()} />);
    const order = bodyOrder();
    expect(order[0]).toContain("Google");
    expect(order[2]).toContain("Amazon");
  });

  it("filters and reports the count against the corpus, never bare", () => {
    render(<FilterableStatTable rows={ROWS} {...base()} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "micro" } });
    expect(bodyOrder()).toHaveLength(1);
    // The count line is split across elements, so assert on the live region's
    // own text rather than a single text node.
    expect(screen.getByRole("status").textContent).toMatch(/1 of 3 employers match/);
  });

  it("offers a way back from an empty filter", () => {
    render(<FilterableStatTable rows={ROWS} {...base()} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
  });

  it("re-sorts when a header is clicked, and flips on the second click", () => {
    render(<FilterableStatTable rows={ROWS} {...base()} />);
    const nameHeader = screen.getByRole("button", { name: /Name/ });
    fireEvent.click(nameHeader);
    expect(bodyOrder()[0]).toContain("Amazon");
    fireEvent.click(nameHeader);
    expect(bodyOrder()[0]).toContain("Microsoft");
  });

  it("sorts nulls LAST in both directions", () => {
    // A missing median is not a low median. Substituting -1 (which the old
    // per-page column definitions did) puts "no data" above every real figure
    // on an ascending sort, which reads as the fastest employer on the page.
    render(<FilterableStatTable rows={ROWS} {...base()} />);
    const daysHeader = screen.getByRole("button", { name: /Days/ });
    fireEvent.click(daysHeader); // numeric: descending first
    expect(bodyOrder()[2]).toContain("Google");
    fireEvent.click(daysHeader); // ascending
    expect(bodyOrder()[2]).toContain("Google");
  });

  it("narrows to a facet value and combines it with the search", () => {
    render(<FilterableStatTable rows={ROWS} {...base()} facets={[STATE_FACET]} />);
    fireEvent.change(screen.getByRole("combobox", { name: /State/ }), {
      target: { value: "WA" },
    });
    expect(bodyOrder()).toHaveLength(2);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "amaz" } });
    expect(bodyOrder()).toHaveLength(1);
    expect(bodyOrder()[0]).toContain("Amazon");
  });

  it("says it is showing a SLICE when the seed is smaller than the corpus", () => {
    // The seed problem: a search over 3 of 12,240 rows answers a question about
    // the corpus using a slice of it and looks exactly like a correct answer.
    render(
      <FilterableStatTable
        rows={ROWS}
        {...base()}
        totalCount={12240}
        loadAll={async () => ROWS}
      />,
    );
    expect(screen.getByRole("status").textContent).toMatch(/Showing the top 3 of 12,240 employers/);
    expect(screen.getByRole("button", { name: /Load all 12,240/ })).toBeInTheDocument();
  });

  it("fetches the whole corpus on the first interaction, and only once", async () => {
    const all: Row[] = [
      ...ROWS,
      { name: "Zynga", total: 10, state: "CA", days: 500 },
    ];
    const loadAll = vi.fn(async () => all);
    render(
      <FilterableStatTable
        rows={ROWS}
        {...base()}
        totalCount={4}
        loadAll={loadAll}
      />,
    );
    fireEvent.focus(screen.getByRole("searchbox"));
    await waitFor(() => expect(bodyOrder()).toHaveLength(4));
    expect(loadAll).toHaveBeenCalledTimes(1);

    // A second interaction must not refetch.
    fireEvent.click(screen.getByRole("button", { name: /Name/ }));
    expect(loadAll).toHaveBeenCalledTimes(1);
  });

  it("says the list failed rather than rendering an empty table", async () => {
    // An empty table reads as "there is nothing here", which is a different
    // and much worse claim than "this did not load".
    const loadAll = vi.fn(async () => {
      throw new Error("HTTP 500");
    });
    render(
      <FilterableStatTable
        rows={ROWS}
        {...base()}
        totalCount={12240}
        loadAll={loadAll}
      />,
    );
    fireEvent.focus(screen.getByRole("searchbox"));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toMatch(/did(n.t| not) load/),
    );
    expect(bodyOrder()).toHaveLength(3);
  });

  it("pages, and never strands the viewer past the end of a filtered list", () => {
    const many: Row[] = Array.from({ length: 60 }, (_, i) => ({
      name: `Co ${String(i).padStart(2, "0")}`,
      total: 1000 - i,
      state: i % 2 === 0 ? "CA" : "WA",
      days: 400,
    }));
    render(<FilterableStatTable rows={many} {...base()} facets={[STATE_FACET]} pageSize={25} />);
    expect(bodyOrder()).toHaveLength(25);
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(bodyOrder()).toHaveLength(10);

  });

  it("asks the server when the LOCAL search finds nothing", async () => {
    // The page downloads a bounded head of the ranking, so a name outside it
    // is absent from `rows` and a purely client-side search answers "no
    // match" for a row that plainly exists. That was 79% of employers.
    const remoteHit: Row = { name: "Tiny Bakery LLC", total: 2, state: "OR", days: null };
    const searchRemote = vi.fn(async () => ({ rows: [remoteHit] }));
    render(
      <FilterableStatTable
        rows={ROWS}
        {...base()}
        totalCount={82677}
        loadAll={async () => ROWS}
        searchRemote={searchRemote}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Tiny Bakery" },
    });
    // `false` is the second argument: the local list came up empty, so the
    // caller is being told it may pay for the expensive published search.
    await waitFor(() =>
      expect(searchRemote).toHaveBeenCalledWith("Tiny Bakery", false),
    );
    await waitFor(() =>
      expect(bodyOrder().some((r) => r.includes("Tiny Bakery LLC"))).toBe(true),
    );
    expect(screen.getByRole("status").textContent).toMatch(/searched across all of them/);
  });

  /**
   * A remote search can find things this table's columns cannot describe.
   *
   * The employer index is the caller that needs it: `perm_live_recent` knows
   * 21,495 employers with no published disclosure record at all, and every
   * column here - filings, certified, denied, approval rate, median days - is
   * computed from decided cases in that record. Packing one as a row would
   * put a fabricated "0 certified, 0 denied" in a sortable table. So the
   * search hands them back separately and they render under the table.
   */
  it("renders extra results the columns cannot describe, with an empty table", async () => {
    const searchRemote = vi.fn(async () => ({
      rows: [],
      extra: <p>Two more sponsors, not in a published DOL file yet</p>,
    }));
    render(
      <FilterableStatTable
        rows={ROWS}
        {...base()}
        totalCount={82677}
        loadAll={async () => ROWS}
        searchRemote={searchRemote}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Lorenz Bus" },
    });
    await waitFor(() =>
      expect(
        screen.getByText(/not in a published DOL file yet/),
      ).toBeInTheDocument(),
    );
    // No row was invented for them: the only <tr> under the header is the
    // empty-state cell, and it spans every column rather than filling them.
    const body = bodyOrder();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatch(/There is more below/);
    // And the empty cell must not say "nothing matches that" over results
    // that are sitting directly underneath it.
    expect(screen.queryByText(/Nothing matches that/)).not.toBeInTheDocument();
    expect(screen.getByText(/There is more below/)).toBeInTheDocument();
  });

  it("keeps the ordinary empty message when there is nothing extra either", async () => {
    // The control for the test above: without it, a message that ALWAYS said
    // "there is more below" would pass that assertion and be wrong here.
    const searchRemote = vi.fn(async () => ({ rows: [] }));
    render(
      <FilterableStatTable
        rows={ROWS}
        {...base()}
        totalCount={82677}
        loadAll={async () => ROWS}
        searchRemote={searchRemote}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "zzzznotacompany" },
    });
    await waitFor(() => expect(searchRemote).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/Nothing matches that/)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/There is more below/)).not.toBeInTheDocument();
  });

  /**
   * The local list answering does NOT end the question, and this test used to
   * assert that it did.
   *
   * It was right about rows and wrong about everything else. A remote search
   * can also return results these columns cannot describe, and whether the
   * table filled says nothing about whether those exist. Measured on the
   * employer index: "lorenz" matches 5 published sponsors, so the table
   * answered, the server was never asked, and LORENZ BUS SERVICE INC - 174
   * live cases, no published record - was unreachable by name.
   *
   * So the call is still made, and `localHasRows` is how the caller is told
   * it may skip the expensive half. What must not change is the TABLE: local
   * rows keep their place and are not replaced by an empty remote list.
   */
  it("tells the caller the local search answered, and keeps the local rows", async () => {
    const searchRemote = vi.fn(async () => ({ rows: [] }));
    render(
      <FilterableStatTable
        rows={ROWS}
        {...base()}
        totalCount={82677}
        loadAll={async () => ROWS}
        searchRemote={searchRemote}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "micro" } });
    await waitFor(() => expect(bodyOrder()).toHaveLength(1));
    await waitFor(() =>
      expect(searchRemote).toHaveBeenCalledWith("micro", true),
    );
    // The empty remote `rows` must not blank a table that had a result.
    expect(bodyOrder()).toHaveLength(1);
    expect(bodyOrder()[0]).toMatch(/Microsoft/i);
  });

  it("shows extra results even when the table already answered", async () => {
    // The case the old trigger could not reach at all.
    const searchRemote = vi.fn(async () => ({
      rows: [],
      extra: <p>Lorenz Bus Service Inc, not in a published DOL file yet</p>,
    }));
    render(
      <FilterableStatTable
        rows={ROWS}
        {...base()}
        totalCount={82677}
        loadAll={async () => ROWS}
        searchRemote={searchRemote}
      />,
    );
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "micro" } });
    await waitFor(() =>
      expect(screen.getByText(/Lorenz Bus Service Inc/)).toBeInTheDocument(),
    );
    // And the table still holds its own result underneath the search.
    expect(bodyOrder()[0]).toMatch(/Microsoft/i);
  });

  it("does not strand the viewer on a page that no longer exists", () => {
    // The clamp's real trigger is the ROW SET shrinking underneath the viewer,
    // not a filter: every control here resets the page to 0, so filtering can
    // never reach this branch. It gets there when the server sends fewer rows
    // on a revalidate while the viewer sits deep in the list.
    //
    // Probed by removing the clamp: an earlier version of this test filtered
    // instead and passed with the clamp gone, which made it decoration.
    const many: Row[] = Array.from({ length: 60 }, (_, i) => ({
      name: `Co ${String(i).padStart(2, "0")}`,
      total: 1000 - i,
      state: "CA",
      days: 400,
    }));
    const { rerender } = render(
      <FilterableStatTable rows={many} {...base()} pageSize={25} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText(/Page 3 of 3/)).toBeInTheDocument();

    rerender(
      <FilterableStatTable rows={many.slice(0, 10)} {...base()} pageSize={25} />,
    );
    expect(bodyOrder()).toHaveLength(10);
  });

  it("changes page size without leaving the viewer on a dead page", () => {
    const many: Row[] = Array.from({ length: 60 }, (_, i) => ({
      name: `Co ${i}`,
      total: 1000 - i,
      state: "CA",
      days: 1,
    }));
    render(<FilterableStatTable rows={many} {...base()} pageSize={25} />);
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /Rows/ }), {
      target: { value: "100" },
    });
    expect(bodyOrder()).toHaveLength(60);
  });
});
