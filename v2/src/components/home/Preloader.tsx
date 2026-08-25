/**
 * The home load curtain. A SERVER component on purpose.
 *
 * Three separate defects were reported against the previous version, and
 * they had three separate causes. All three are addressed here.
 *
 * 1. "still see the blank site with header before this pops up"
 *
 *    The cover rule (`html[data-pre="on"] body::before`) lived in
 *    globals.css, and so did the `var(--background)` it painted with.
 *    globals.css is an EXTERNAL stylesheet, and WebKit paints before a
 *    pending stylesheet — so on a cold or slow load the boot script set the
 *    attribute, the browser painted the header, and the cover only appeared
 *    once the stylesheet landed. The attribute was doing its job; there was
 *    simply no rule in the document yet to act on it.
 *
 *    PRELOADER_CSS below is now inlined in <head>, above the script, with
 *    LITERAL colours rather than custom properties (a var() defined in the
 *    same pending stylesheet is no better than the rule that uses it).
 *
 * 2. "sometimes doesn't even appear"
 *
 *    A sessionStorage flag skipped the curtain for the rest of the session,
 *    so whether you saw it depended on invisible state. Removed: it now
 *    behaves the same way every time. The cap is short and any interaction
 *    dismisses it, so showing it always is cheap.
 *
 * 3. "skeleton loading states and blank page with just header happens
 *    instead" on a client-side navigation
 *
 *    The boot script runs once per DOCUMENT. Clicking Home from /blog is a
 *    soft navigation — no new document, no script, so the route's ordinary
 *    loading.tsx skeleton showed instead. Handled by HomeCurtainNav, which
 *    arms the same attribute on link click. See that file.
 *
 * Doctrine carried from the client-site fleet:
 *   - the failsafe timer is armed FIRST, before anything that can throw
 *   - dismiss on window load OR the cap, whichever comes first
 *   - never wait on a lazy image; the cap is the only guarantee
 *   - scroll locked via html[data-pre="on"], released by the same attribute
 *   - <noscript> removes it entirely when JS is off
 *   - never a 0s CSS animation as the failsafe: it applies its end state
 *     immediately and the panel never paints at all
 */

// 1200, not 1800. The cap is the only guarantee, so it is also the longest
// anyone can be made to wait for decoration. 1.8s reads as "stuck".
const CAP_MS = 1200;
const EXIT_MS = 560;

// Literal, because these are the two values of --background and this CSS has
// to work before the stylesheet that defines that variable exists.
const BG_LIGHT = "#FAFAFA";
const BG_DARK = "#0A0A0A";

/**
 * The only rules that must exist before first paint. Everything else about
 * the curtain's appearance can arrive with globals.css, because by then the
 * cover is already up and nothing underneath is visible.
 *
 * Theme resolution mirrors next-themes (attribute="class", defaultTheme=
 * "system"): prefers-color-scheme is the correct guess when no explicit
 * choice has been made, and the .light/.dark classes it writes onto <html>
 * override it in both directions.
 */
export const PRELOADER_CSS = `
html[data-pre="on"]{overflow:hidden}
html:not([data-pre="on"]) .pre{display:none}
html[data-pre="on"] body::before{content:"";position:fixed;inset:0;z-index:199;background:${BG_LIGHT}}
@media (prefers-color-scheme:dark){
html[data-pre="on"]:not(.light) body::before{background:${BG_DARK}}
}
html[data-pre="on"].dark body::before{background:${BG_DARK}}
html[data-pre="on"].light body::before{background:${BG_LIGHT}}
`;

/**
 * Runs before first paint. Kept deliberately small and dependency-free —
 * everything it touches exists at parse time.
 */
export const PRELOADER_BOOT = `
(function(){
  var d=document,h=d.documentElement;
  // Runs from <head>, so it fires on EVERY route and has to exclude itself.
  // The curtain is a home-page device; the rest of the site has no .pre
  // markup and an attribute set there would lock scroll over nothing.
  //
  // Soft navigations never reach this line at all (no new document), which
  // is what HomeCurtainNav exists to cover.
  if(location.pathname!=='/')return;
  h.setAttribute('data-pre','on');
  var done=false;
  function leave(){
    if(done)return; done=true;
    var el=d.querySelector('.pre');
    if(el)el.classList.add('pre-leave');
    setTimeout(function(){
      h.setAttribute('data-pre','off');
      if(el&&el.parentNode)el.parentNode.removeChild(el);
    },${EXIT_MS});
  }
  var cap=setTimeout(leave,${CAP_MS});
  // ANY interaction dismisses it. Two reasons, both real bugs before this.
  //
  // The pathname gate above is evaluated ONCE, at parse time. A visitor who
  // clicks a link on the home page before the curtain lifts carries
  // data-pre="on" with them, so the full-viewport cover AND the scroll lock
  // land on /signup, where there is no .pre markup to animate out. The page
  // underneath is fine and completely hidden, which is exactly the reported
  // "loads forever, have to refresh".
  //
  // And independently: a curtain that ignores someone who is already trying
  // to use the page is not a load state, it is an obstacle. leave() is
  // idempotent, so firing it early costs nothing.
  ['click','keydown','wheel','touchstart','pointerdown'].forEach(function(t){
    addEventListener(t,leave,{once:true,capture:true,passive:true});
  });
  addEventListener('pagehide',leave,{once:true});
  function ready(){
    clearTimeout(cap);
    var fonts=(d.fonts&&d.fonts.ready)?d.fonts.ready:Promise.resolve();
    Promise.race([fonts,new Promise(function(r){setTimeout(r,600)})]).then(leave,leave);
  }
  if(d.readyState==='complete')ready();
  else addEventListener('load',ready,{once:true});
})();
`;

export function Preloader() {
  return (
    <>
      <div className="pre" role="status" aria-label="Loading PERM Tracker">
        {/* The header's own document mark, inlined so nothing has to load. */}
        <svg
          className="pre-mark"
          width="56"
          height="56"
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
        <div className="pre-name">
          <b>PERM</b> Tracker
        </div>{" "}
        <div className="pre-sub">Live DOL data · Automatic deadlines</div>{" "}
        <div className="pre-track">
          <i className="pre-bar" />
        </div>{" "}
        <div className="pre-spin" aria-hidden="true" />
      </div>
      <noscript>
        {/* With JS off nothing can ever dismiss it, so it must not exist. */}
        <style>{`.pre{display:none}html{overflow:auto}`}</style>
      </noscript>
    </>
  );
}
