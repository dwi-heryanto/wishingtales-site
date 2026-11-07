/**
 * Runs before the rest of the page is parsed, so the stored reader theme is on
 * <html> for the first paint. Without this, a dark-mode reader gets a white
 * flash on every navigation.
 *
 * The default is the page's, not the browser's (ADR-0002's third amendment): the
 * first URL segment decides whether this is the adult area (dark) or the
 * children's library (warm paper). `prefers-color-scheme` is deliberately not
 * consulted — a dark laptop used at bedtime is still a children's page, and the
 * reader's own stored choice always wins. The colour map here duplicates
 * `site/lib/theme.ts` because this has to be a string that runs before React.
 */
const SCRIPT = `(function(){try{
var d=document.documentElement;
var seg=(location.pathname.split("/")[1]||"").replace(/%2B/i,"+");
var adult=seg==="13+"||seg==="18+";
var t=localStorage.getItem("wt:theme");
if(t!=="light"&&t!=="sepia"&&t!=="dark"){t=adult?"dark":"light";}
d.setAttribute("data-reader-theme",t);
var meta=document.querySelector('meta[name="theme-color"]');
if(meta)meta.setAttribute("content",t==="dark"?"#1c1815":t==="sepia"?"#efe4cc":"#f7f2ea");
var s=localStorage.getItem("wt:scale");
if(s)d.style.setProperty("--reader-scale",s);
var l=localStorage.getItem("wt:leading");
if(l)d.style.setProperty("--reader-leading",l);
if(localStorage.getItem("wt:mode")==="read-aloud")d.setAttribute("data-mode","read-aloud");
}catch(e){}})();`;

export function ReaderThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
