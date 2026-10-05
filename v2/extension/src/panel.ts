/**
 * The panel, drawn into a shadow root so the job site's CSS can't reach it
 * and its CSS can't reach the job site. Closed in the extension; the tests
 * open it to look inside.
 *
 * Every value is set as text, never as markup: an employer's name comes from
 * the page and the API, and neither may become HTML here.
 *
 * Square corners, a 2px border and a hard offset shadow, lime for the mark,
 * the site's dark-lime ink for the link: PERM Tracker's own look. No motion at
 * all, so there's nothing for reduced-motion to turn off.
 */

import { ICONS } from "./icons";
import type { PanelModel } from "./model";

export const HOST_ID = "permtracker-sponsor-panel";

const CSS = `
:host { all: initial; }
.panel {
  --bg: #ffffff; --fg: #000000; --muted: #4d4d4d; --border: #000000; --ink: #1d8229;
  --caution-bg: #fff4d6; --mark: #2ecc40;
  position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;
  width: min(340px, calc(100vw - 32px)); max-height: calc(100vh - 32px); overflow: auto;
  box-sizing: border-box; background: var(--bg); color: var(--fg);
  border: 2px solid var(--border); box-shadow: 5px 5px 0 #000000; border-radius: 0;
  font: 400 15px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  text-align: left; letter-spacing: normal;
}
@media (prefers-color-scheme: dark) {
  .panel { --bg: #1a1a1a; --fg: #fafafa; --muted: #c4c4c4; --border: #fafafa; --ink: #2ecc40; --caution-bg: #3a3000; }
}
.head { display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 14px; border-bottom: 2px solid var(--border); }
.mark { width: 28px; height: 28px; flex: none; display: block; }
.brand { font-weight: 800; font-size: 15px; flex: 1; }
.close { all: unset; box-sizing: border-box; width: 44px; height: 44px; display: inline-flex; align-items: center;
  justify-content: center; cursor: pointer; color: var(--fg); border: 2px solid transparent; }
.close:hover { border-color: var(--border); }
.close:focus-visible, a:focus-visible, .retry:focus-visible { outline: 3px solid var(--mark); outline-offset: 2px; }
.close svg { width: 18px; height: 18px; fill: currentColor; }
.body { padding: 14px; }
h2 { margin: 0; font-size: 17px; line-height: 1.3; font-weight: 800; overflow-wrap: anywhere; }
.notice { margin: 10px 0 0; padding: 10px 12px; border: 2px solid var(--border); font-size: 14px; }
.notice.caution { background: var(--caution-bg); }
dl { margin: 12px 0 0; display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; }
dt { font-size: 14px; color: var(--muted); }
dd { margin: 0; font-size: 15px; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
dd small { display: block; font-size: 14px; font-weight: 400; color: var(--muted); }
.actions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
a { color: var(--ink); font-weight: 800; text-decoration: underline; text-underline-offset: 3px;
  display: inline-flex; align-items: center; min-height: 44px; }
.retry { all: unset; box-sizing: border-box; cursor: pointer; min-height: 44px; padding: 0 14px; font-weight: 800;
  border: 2px solid var(--border); background: var(--mark); color: #000000; box-shadow: 3px 3px 0 #000000; }
.foot { margin: 12px 0 0; font-size: 14px; color: var(--muted); }
`;

export interface PanelHandle {
  show(model: PanelModel): void;
  hide(): void;
  isOpen(): boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function mountPanel(
  doc: Document,
  opts: { onClose: () => void; onRetry: () => void; mode?: "open" | "closed" },
): PanelHandle & { root: ShadowRoot } {
  doc.getElementById(HOST_ID)?.remove();
  const host = doc.createElement("div");
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: opts.mode ?? "closed" });
  const style = el(doc, "style");
  style.textContent = CSS;
  root.append(style);
  doc.documentElement.append(host);

  let panel: HTMLElement | null = null;

  const hide = () => {
    panel?.remove();
    panel = null;
  };

  const show = (m: PanelModel) => {
    const next = el(doc, "aside", "panel");
    next.setAttribute("aria-label", "PERM Tracker sponsorship record");
    next.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape") {
        hide();
        opts.onClose();
      }
    });

    const head = el(doc, "div", "head");
    const svgNS = "http://www.w3.org/2000/svg";
    // The brand mark, as public/icon.svg draws it.
    const mark = doc.createElementNS(svgNS, "svg");
    mark.setAttribute("class", "mark");
    mark.setAttribute("viewBox", "0 0 192 192");
    mark.setAttribute("aria-hidden", "true");
    const tile = doc.createElementNS(svgNS, "rect");
    tile.setAttribute("width", "192");
    tile.setAttribute("height", "192");
    tile.setAttribute("rx", "24");
    tile.setAttribute("fill", "#2ecc40");
    const p = doc.createElementNS(svgNS, "path");
    p.setAttribute("fill", "#fff");
    p.setAttribute("fill-rule", "evenodd");
    p.setAttribute("d", ICONS.markP);
    const t = doc.createElementNS(svgNS, "path");
    t.setAttribute("fill", "#fff");
    t.setAttribute("d", ICONS.markT);
    mark.append(tile, p, t);
    const close = el(doc, "button", "close");
    close.type = "button";
    close.setAttribute("aria-label", "Close");
    const svg = doc.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 256 256");
    svg.setAttribute("aria-hidden", "true");
    const path = doc.createElementNS(svgNS, "path");
    path.setAttribute("d", ICONS.x);
    svg.append(path);
    close.append(svg);
    close.addEventListener("click", () => {
      hide();
      opts.onClose();
    });
    head.append(mark, el(doc, "span", "brand", "PERM Tracker"), close);

    const body = el(doc, "div", "body");
    body.append(el(doc, "h2", undefined, m.title));
    if (m.notice) {
      const n = el(doc, "p", `notice${m.tone === "caution" ? " caution" : ""}`, m.notice);
      if (m.busy) n.setAttribute("role", "status");
      body.append(n);
    }
    if (m.rows.length > 0) {
      const dl = el(doc, "dl");
      for (const r of m.rows) {
        const dd = el(doc, "dd", undefined, r.value);
        if (r.note) dd.append(el(doc, "small", undefined, r.note));
        dl.append(el(doc, "dt", undefined, r.label), dd);
      }
      body.append(dl);
    }
    if (m.link || m.retry) {
      const actions = el(doc, "div", "actions");
      if (m.link) {
        const a = el(doc, "a", undefined, m.link.text);
        a.href = m.link.href;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        actions.append(a);
      }
      if (m.retry) {
        const b = el(doc, "button", "retry", "Try again");
        b.type = "button";
        b.addEventListener("click", () => opts.onRetry());
        actions.append(b);
      }
      body.append(actions);
    }
    if (m.footer) body.append(el(doc, "p", "foot", m.footer));

    next.append(head, body);
    if (panel) panel.replaceWith(next);
    else root.append(next);
    panel = next;
  };

  return { show, hide, isOpen: () => panel !== null, root };
}
