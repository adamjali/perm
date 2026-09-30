/**
 * The home load curtain: markup, the CSS that paints it and the script that
 * arms it. The markup is rendered by the ROOT layout as the first child of
 * <body>, on every route, and stays hidden unless the boot script (first in
 * <head>, home only) sets html[data-pre].
 *
 * Why each piece sits where it does (every one was a reported defect first):
 *
 * - The CSS is inline in <head>, with LITERAL colours. globals.css is an
 *   external stylesheet and WebKit paints before a pending stylesheet, so a
 *   rule living there arrived after the header had already painted.
 *
 * - The panel is SERVER markup at the top of <body>. It used to be rendered
 *   by the home page (56 KB into the document, so the header painted first),
 *   then injected by the script at DOMContentLoaded, which showed a blank
 *   cover until the whole document had parsed. At the top of <body> it paints
 *   in the same frame as everything else. React owns the element, so the
 *   script never touches it: every state is an attribute on <html>.
 *
 * - The exit slides the panel away over the PAGE. It used to slide over a
 *   second blank cover that stayed until the slide ended, so the logo left an
 *   empty screen and the page snapped in afterwards.
 *
 * - It lifts at DOMContentLoaded, not window.load. The home page is server
 *   rendered, so the document is complete at DOMContentLoaded; waiting for
 *   every image held a finished page behind the curtain for seconds.
 *
 * - Hard loads of "/" only. A client navigation to home is a prerendered,
 *   prefetched page that renders at once, so a curtain there is pure delay
 *   (the old one blanked the whole screen, header included, for 820 ms).
 *
 * - No scroll lock. Any wheel, touch or key dismisses it at once, so there is
 *   nothing to lock, and releasing overflow:hidden brought the scrollbar back
 *   mid-slide and shifted the page sideways on Windows.
 *
 * The attribute has three states: "on" (panel up), "leaving" (sliding away,
 * page visible), "off" (gone). Absent means never armed.
 */

// 1200, not 1800. The cap is the only guarantee, so it is also the longest
// anyone can be made to wait for decoration. 1.8s reads as "stuck".
const CAP_MS = 1200;
const EXIT_MS = 560;

/**
 * The shortest the curtain may be visible. On a warm load DOMContentLoaded
 * comes in a few hundred milliseconds, and a curtain shorter than this reads
 * as a flash of the wrong thing rather than as a deliberate load state.
 */
const MIN_MS = 600;

// Literal, because these are the two values of --background and this CSS has
// to work before the stylesheet that defines that variable exists.
const BG_LIGHT = "#FAFAFA";
const BG_DARK = "#0A0A0A";

/**
 * Everything needed to PAINT the curtain, inline in <head>. Theme resolution
 * mirrors next-themes (attribute="class", defaultTheme="system"):
 * prefers-color-scheme is the guess until a .light/.dark class says otherwise.
 */
export const PRELOADER_CSS = `
/* Private tokens, literal: globals.css may not have loaded yet. */
html[data-pre]{--_pb:${BG_LIGHT};--_pf:#000;--_pp:#2ECC40;--_pbd:#000;--_pc:#FAFAFA}
@media (prefers-color-scheme:dark){
html[data-pre]:not(.light){--_pb:${BG_DARK};--_pf:#FAFAFA;--_pbd:#333;--_pc:#1A1A1A}
}
html[data-pre].dark{--_pb:${BG_DARK};--_pf:#FAFAFA;--_pbd:#333;--_pc:#1A1A1A}
html[data-pre].light{--_pb:${BG_LIGHT};--_pf:#000;--_pbd:#000;--_pc:#FAFAFA}

/* Hidden unless armed. An ABSENT attribute must hide it too: every route
   renders the panel and only "/" ever sets the attribute. */
.pre{display:none}
html[data-pre="on"] .pre,html[data-pre="leaving"] .pre{display:flex}
.pre{position:fixed;inset:0;z-index:200;flex-direction:column;
align-items:center;justify-content:center;gap:18px;background:var(--_pb);
transition:transform .55s cubic-bezier(.65,0,.35,1)}
html[data-pre="leaving"] .pre{transform:translateY(-101%);pointer-events:none}
.pre-mark{color:var(--_pp)}
.pre-name{font-family:var(--font-heading),system-ui,-apple-system,sans-serif;font-weight:900;
font-size:clamp(1.6rem,4vw,2.1rem);letter-spacing:-.02em;line-height:1;color:var(--_pf)}
.pre-name b{color:var(--_pp);font-weight:900}
.pre-sub{font-family:var(--font-mono),ui-monospace,SFMono-Regular,monospace;font-size:.7rem;
font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--_pf);opacity:.55}
.pre-track{width:min(260px,60vw);height:6px;border:2px solid var(--_pbd);
background:var(--_pc);overflow:hidden}
.pre-bar{display:block;height:100%;background:var(--_pp);transform-origin:left;
animation:pre-fill 1.2s cubic-bezier(.22,1,.36,1) forwards}
@keyframes pre-fill{from{transform:scaleX(0)}to{transform:scaleX(.92)}}
@media (prefers-reduced-motion:reduce){
.pre-bar{animation:none;transform:scaleX(.92)}
.pre{transition:opacity .25s ease}
html[data-pre="leaving"] .pre{transform:none;opacity:0}
}
`;

/**
 * Runs from <head> before first paint, on every route, so it excludes itself
 * from all but "/". Small and dependency-free: everything it touches exists
 * at parse time.
 */
export const PRELOADER_BOOT = `
(function(){
  var d=document,h=d.documentElement;
  if(location.pathname!=='/')return;
  // Escape hatch for tooling (headless shots, audits): ?nopre=1 never sets
  // the attribute, which is a complete and safe opt-out.
  if(location.search.indexOf('nopre=1')>-1)return;

  // Always-on flight recorder, ~zero cost. Read it from the console as
  // window.__ptCurtain.events, or add ?prediag=1 to render it on the page.
  var EV=[],T0=Date.now();
  function ev(n){EV.push((Date.now()-T0)+'ms '+n)}
  window.__ptCurtain={events:EV};
  ev('parse rs='+d.readyState+' prerendering='+!!d.prerendering+' vis='+d.visibilityState);

  function start(){
    var t0=Date.now(),done=false;
    ev('start');
    h.setAttribute('data-pre','on');
    function leave(){
      if(done)return;
      var waited=Date.now()-t0;
      if(waited<${MIN_MS}){setTimeout(leave,${MIN_MS}-waited);return}
      done=true;
      ev('leave after '+waited+'ms');
      exit();
    }
    function leaveNow(){
      // Bypasses the floor: someone clicking or scrolling has stopped waiting.
      if(done)return; done=true;
      ev('leaveNow (interaction)');
      exit();
    }
    function exit(){
      clearTimeout(cap);
      h.setAttribute('data-pre','leaving');
      setTimeout(function(){h.setAttribute('data-pre','off');diag()},${EXIT_MS});
    }
    // The failsafe is armed first, before anything that can throw.
    var cap=setTimeout(leave,${CAP_MS});
    ['click','keydown','wheel','touchstart','pointerdown'].forEach(function(t){
      addEventListener(t,leaveNow,{once:true,capture:true,passive:true});
    });
    addEventListener('pagehide',leaveNow,{once:true});
    function ready(){
      var fonts=(d.fonts&&d.fonts.ready)?d.fonts.ready:Promise.resolve();
      Promise.race([fonts,new Promise(function(r){setTimeout(r,400)})]).then(leave,leave);
    }
    if(d.readyState!=='loading')ready();
    else d.addEventListener('DOMContentLoaded',function(){ev('DOMContentLoaded');ready()},{once:true});
  }

  function diag(){
    if(location.search.indexOf('prediag=1')<0)return;
    try{
      var nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
      if(nav)EV.push('activationStart='+Math.round(nav.activationStart||0));
      var o=d.createElement('pre');
      o.style.cssText='position:fixed;left:8px;bottom:8px;z-index:9999;background:#000;color:#2ECC40;font:11px/1.5 monospace;padding:10px 12px;max-width:92vw;overflow:auto;border:2px solid #2ECC40;margin:0';
      o.textContent='curtain timeline\\n'+EV.join('\\n');
      d.body.appendChild(o);
    }catch(e){}
  }

  // THE WHOLE BUG, verified against Chrome's own docs. Typing a
  // high-confidence URL into the address bar PRERENDERS the page: the full
  // document loads and scripts execute invisibly, before the tab exists to
  // the user. This script ran, the curtain showed and dismissed with nobody
  // watching, and activation revealed a page with no curtain - plus the
  // hydration entrance animations replaying uncovered, which is the reported
  // "everything loads twice" stutter. permtracker is typed daily, so it IS
  // the high-confidence case; the ~/money sites never get typed, never get
  // prerendered, and therefore "are perfect".
  //
  // document.prerendering is true during that phase, and prerenderingchange
  // fires exactly at activation - the first moment a human can see the page.
  // The same reasoning covers a tab opened in the background: defer to the
  // first visibilitychange. (This also means the always-hidden automation
  // tab never arms the curtain, which is correct for screenshots.)
  if(d.prerendering){
    ev('deferring: prerendering');
    d.addEventListener('prerenderingchange',function(){ev('activated');start()},{once:true});
  }else if(d.visibilityState==='hidden'){
    ev('deferring: hidden tab');
    d.addEventListener('visibilitychange',function f(){
      if(d.visibilityState!=='visible')return;
      d.removeEventListener('visibilitychange',f);
      // Loaded while hidden (a background tab, cmd+click): by the time it is
      // revealed the page is already painted, so raising the curtain now
      // flashes it over ready content - the "mini glitch". Nothing to cover.
      if(d.readyState!=='loading'){ev('visible; already loaded, no curtain');return;}
      ev('became visible');start();
    });
  }else{
    start();
  }
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
        </div>
      </div>
      <noscript>
        {/* With JS off nothing can ever dismiss it, so it must not exist. */}
        <style>{`.pre{display:none!important}`}</style>
      </noscript>
    </>
  );
}
