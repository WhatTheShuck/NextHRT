/**
 * Client-side theme application — mirrors the server-side renderThemeCss logic.
 * Must not import anything that runs server-side (prisma, fs, etc.).
 */

export function buildThemeCss(
  cssVars: Record<string, string>,
  darkCssVars: Record<string, string>
): string {
  const parts: string[] = [];

  const lightEntries = Object.entries(cssVars);
  if (lightEntries.length > 0) {
    parts.push(`:root {\n${lightEntries.map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`);
  }

  const darkEntries = Object.entries(darkCssVars);
  if (darkEntries.length > 0) {
    parts.push(`.dark {\n${darkEntries.map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`);
  }

  return parts.join("\n");
}

/** Apply a theme immediately to the DOM and persist it to localStorage for FOUC prevention. */
export function applyTheme(
  id: string,
  cssVars: Record<string, string>,
  darkCssVars: Record<string, string>
): void {
  const css = buildThemeCss(cssVars, darkCssVars);

  // Update the server-injected style tag in place
  const el = document.getElementById("hrt-theme-inline");
  if (el) el.textContent = css;

  // Persist for next-visit FOUC prevention (mirrors ThemeScript logic)
  try {
    localStorage.setItem("hrt-theme-id", id);
    localStorage.setItem("hrt-theme-css", css);
  } catch {
    // Private browsing / storage quota — silently ignore
  }
}

/** Clear the user's theme override and revert to the server-resolved default. */
export function clearTheme(): void {
  const el = document.getElementById("hrt-theme-inline");
  if (el) el.textContent = "";

  try {
    localStorage.removeItem("hrt-theme-id");
    localStorage.removeItem("hrt-theme-css");
  } catch {
    // ignore
  }
}
