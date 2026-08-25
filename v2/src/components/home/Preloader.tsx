"use client";

import { useEffect, useState } from "react";

/**
 * The load curtain, fleet pattern: dark ground, brand mark, wordmark,
 * progress bar, spinner, slide-up exit.
 *
 * The first version flashed the page before covering it, because its styling
 * lived in the linked stylesheet: the browser paints the raw document before
 * a pending stylesheet arrives, so the curtain existed in the HTML and looked
 * like nothing. Every rule it needs now ships in its own inline <style>,
 * parsed with the markup — the curtain is styled from the first paint or it
 * is not a curtain.
 *
 * Doctrine carried over: the timeout failsafe is armed before anything that
 * could throw; dismiss on window load or the cap, whichever first; never wait
 * on a lazy image; session-once; reduced motion gets a fade.
 */

const CAP_MS = 1600;
const KEY = "pt-preloaded";

const CSS = `
.pt-pre{position:fixed;inset:0;z-index:200;background:#0a0a0a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;transform:translateY(0);transition:transform .6s cubic-bezier(.76,0,.24,1)}
.pt-pre.leave{transform:translateY(-101%)}
.pt-pre-mark{width:56px;height:56px;color:#2ECC40;animation:ptPreIn .5s cubic-bezier(.2,.8,.2,1) both}
.pt-pre-name{font-weight:800;font-size:clamp(1.6rem,4vw,2.1rem);letter-spacing:-.02em;line-height:1;color:#fff;animation:ptPreIn .5s .06s cubic-bezier(.2,.8,.2,1) both}
.pt-pre-name b{color:#2ECC40;font-weight:800}
.pt-pre-sub{font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.55);font-weight:700;animation:ptPreIn .5s .12s cubic-bezier(.2,.8,.2,1) both}
.pt-pre-bar{width:min(260px,60vw);height:4px;background:rgba(255,255,255,.14);overflow:hidden;border:1px solid rgba(255,255,255,.18);animation:ptPreIn .5s .16s cubic-bezier(.2,.8,.2,1) both}
.pt-pre-bar i{display:block;height:100%;background:#2ECC40;transform-origin:left;animation:ptPreBar 1.45s cubic-bezier(.3,.6,.4,1) both}
.pt-pre-spin{width:18px;height:18px;border:2.5px solid rgba(255,255,255,.22);border-top-color:#2ECC40;border-radius:50%;animation:ptPreSpin .68s linear infinite}
@keyframes ptPreIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes ptPreBar{from{transform:scaleX(0)}to{transform:scaleX(.92)}}
@keyframes ptPreSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.pt-pre{transition:opacity .3s ease}.pt-pre.leave{transform:none;opacity:0}.pt-pre-spin,.pt-pre-bar i{animation:none}.pt-pre-bar i{transform:scaleX(.92)}.pt-pre-mark,.pt-pre-name,.pt-pre-sub,.pt-pre-bar{animation:none}}
`;

export function Preloader() {
  const [gone, setGone] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(KEY)) {
      setGone(true);
      return;
    }
    let done = false;
    const leave = () => {
      if (done) return;
      done = true;
      sessionStorage.setItem(KEY, "1");
      setLeaving(true);
      window.setTimeout(() => setGone(true), 640);
    };
    // Failsafe FIRST.
    const cap = window.setTimeout(leave, CAP_MS);
    if (document.readyState === "complete") leave();
    else window.addEventListener("load", leave, { once: true });
    return () => window.clearTimeout(cap);
  }, []);

  if (gone) return null;

  return (
    <div className={"pt-pre pre" + (leaving ? " leave" : "")} role="status" aria-label="Loading">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* The header's own document mark, inlined so nothing has to load. */}
      <svg
        className="pt-pre-mark"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
        <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        <path d="M10 9H8" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
      </svg>
      <div className="pt-pre-name">
        <b>PERM</b> Tracker
      </div>{" "}
      <div className="pt-pre-sub">Live DOL data · Automatic deadlines</div>{" "}
      <div className="pt-pre-bar">
        <i />
      </div>{" "}
      <div className="pt-pre-spin" aria-hidden="true" />
    </div>
  );
}
