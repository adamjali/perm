/**
 * What the content script does on a page, without Chrome in it, so it's tested.
 *
 * On a listed job site it watches the page (they're single-page apps: the
 * posting changes without a page load) and looks up each new employer once.
 * Injected by a click on any other site, it reads the posting once and shows
 * the panel either way, saying so when there's no posting to read.
 *
 * Closing the panel keeps it closed on this page until the toolbar button is
 * clicked: it shouldn't come back on every posting someone scrolls past.
 */
import { extractEmployer } from "./extract";
import type { LookupReply } from "./lookup";
import { panelFor, type PanelModel } from "./model";

export interface PanelLike {
  show(model: PanelModel): void;
  hide(): void;
}

export interface Controller {
  /** Re-read the page; on a listed site, called whenever it changes. */
  check(): Promise<void>;
  /** The toolbar button: open again, re-reading the page and asking afresh. */
  open(): Promise<void>;
  /** The panel's close button. */
  closed(): void;
}

export function createController(deps: {
  /** The page as it is now (a single-page app swaps its content in place). */
  doc: () => Document;
  url: () => URL;
  lookup: (name: string) => Promise<LookupReply | null>;
  panel: PanelLike;
  /** Injected by a click on a site we don't list. */
  manual: boolean;
}): Controller {
  let current: string | null = null;
  let dismissed = false;
  let asked = 0;

  async function run(force: boolean): Promise<void> {
    const found = extractEmployer(deps.doc(), deps.url());
    if (!found) {
      if (force || deps.manual) deps.panel.show(panelFor({ kind: "nothing" }));
      else if (current) {
        deps.panel.hide();
        current = null;
      }
      return;
    }
    if (!force && found.name === current) return;
    current = found.name;
    if (dismissed && !force) return;

    const ticket = ++asked;
    deps.panel.show(panelFor({ kind: "loading", name: found.name }));
    const reply = await deps.lookup(found.name).catch(() => null);
    // The reader moved to another posting while this one was asked about.
    if (ticket !== asked) return;
    if (!reply) {
      deps.panel.show(panelFor({ kind: "error", name: found.name, message: "Couldn't reach PERM Tracker. Try again." }));
    } else if (reply.ok) {
      deps.panel.show(panelFor({ kind: "answer", answer: reply.answer }));
    } else {
      deps.panel.show(panelFor({ kind: "error", name: found.name, message: reply.message }));
    }
  }

  return {
    check: () => run(deps.manual),
    open: () => {
      dismissed = false;
      return run(true);
    },
    closed: () => {
      dismissed = true;
    },
  };
}
