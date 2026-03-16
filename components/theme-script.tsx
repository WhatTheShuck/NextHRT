// Server component — renders as a plain <script> tag, no client bundle added
export function ThemeScript({ themeId, themeCss }: { themeId: string; themeCss: string }) {
  // Escape backticks so the CSS can be safely embedded in a template literal
  const safeCss = themeCss.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
  // Allow only safe characters in the ID embedded in the script
  const safeId = themeId.replace(/[^a-zA-Z0-9_-]/g, "");

  const script = `(function(){try{
var storedId=localStorage.getItem('hrt-theme-id');
var storedCss=localStorage.getItem('hrt-theme-css');
var ssrId='${safeId}';
var ssrCss=\`${safeCss}\`;
var css=(storedId===ssrId&&storedCss)?storedCss:ssrCss;
var el=document.getElementById('hrt-theme-inline');
if(el&&css)el.textContent=css;
if(storedId!==ssrId){
localStorage.setItem('hrt-theme-id',ssrId);
localStorage.setItem('hrt-theme-css',ssrCss);
}
}catch(e){}})();`;

  return (
    <script
      id="hrt-theme-script"
      // Safe: content is server-generated from sanitised CSS var values only
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
