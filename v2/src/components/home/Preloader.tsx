/**
 * The home load curtain. A SERVER component on purpose.
 *
 * The previous version was a client component that styled itself from an
 * inline <style> and gated on React state, which meant it could not exist
 * until hydration — so the page painted first and the curtain arrived after
 * it, which is the opposite of a curtain. It also skipped itself via
 * sessionStorage inside that same effect, so a returning visitor saw a flash
 * of nothing at all.
 *
 * This version renders as static markup in the server response, and its
 * boot script runs from <head> (see PRELOADER_BOOT, mounted in the root
 * layout) so the decision is made before a byte of body paints.
 *
 * THE SCRIPT CANNOT LIVE HERE, and the previous version's claim that it ran
 * "before the browser paints the body" was measurably false. This component
 * is rendered by the home PAGE, which sits below the layout's header, so on
 * the deployed document <header> was at byte 8,339 and this markup at
 * 64,073. Any connection slow enough to paint incrementally showed the
 * header and then had the curtain slam over it. The cover is now drawn by
 * `html[data-pre="on"] body::before`, which needs no markup at all.
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

const CAP_MS = 1800;
const EXIT_MS = 560;

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
  if(location.pathname!=='/')return;
  try{
    if(sessionStorage.getItem('pt-preloaded')){h.setAttribute('data-pre','off');return}
  }catch(e){}
  h.setAttribute('data-pre','on');
  var done=false;
  function leave(){
    if(done)return; done=true;
    try{sessionStorage.setItem('pt-preloaded','1')}catch(e){}
    var el=d.querySelector('.pre');
    if(el)el.classList.add('pre-leave');
    setTimeout(function(){
      h.setAttribute('data-pre','off');
      if(el&&el.parentNode)el.parentNode.removeChild(el);
    },${EXIT_MS});
  }
  var cap=setTimeout(leave,${CAP_MS});
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
