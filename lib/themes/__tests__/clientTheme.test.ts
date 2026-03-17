// @vitest-environment happy-dom
// lib/themes/__tests__/clientTheme.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildThemeCss, applyTheme, clearTheme } from "@/lib/themes/clientTheme";

// ─── helpers ──────────────────────────────────────────────────────────────────

function setupStyleElement(): HTMLStyleElement {
  document.head.replaceChildren();
  const style = document.createElement("style");
  style.id = "hrt-theme-inline";
  document.head.appendChild(style);
  return style;
}

// ─── buildThemeCss ────────────────────────────────────────────────────────────

describe("buildThemeCss", () => {
  it("generates a :root block from light vars", () => {
    const css = buildThemeCss({ "--primary": "266 85% 58%" }, {});
    expect(css).toContain(":root {");
    expect(css).toContain("  --primary: 266 85% 58%;");
    expect(css).not.toContain(".dark");
  });

  it("generates a .dark block from dark vars", () => {
    const css = buildThemeCss({}, { "--primary": "267 84% 81%" });
    expect(css).toContain(".dark {");
    expect(css).toContain("  --primary: 267 84% 81%;");
    expect(css).not.toContain(":root");
  });

  it("generates both :root and .dark blocks when both are provided", () => {
    const css = buildThemeCss(
      { "--primary": "266 85% 58%" },
      { "--primary": "267 84% 81%" }
    );
    expect(css).toContain(":root {");
    expect(css).toContain(".dark {");
  });

  it("returns an empty string when both objects are empty", () => {
    expect(buildThemeCss({}, {})).toBe("");
  });

  it("includes multiple vars in the block", () => {
    const css = buildThemeCss(
      { "--primary": "266 85% 58%", "--background": "0 0% 100%" },
      {}
    );
    expect(css).toContain("--primary: 266 85% 58%;");
    expect(css).toContain("--background: 0 0% 100%;");
  });
});

// ─── applyTheme ───────────────────────────────────────────────────────────────

describe("applyTheme", () => {
  beforeEach(() => {
    setupStyleElement();
    localStorage.clear();
  });

  it("sets the textContent of #hrt-theme-inline", () => {
    applyTheme("test-id", { "--primary": "266 85% 58%" }, {});
    const el = document.getElementById("hrt-theme-inline");
    expect(el?.textContent).toContain("--primary: 266 85% 58%;");
  });

  it("writes hrt-theme-id to localStorage", () => {
    applyTheme("my-theme-id", { "--primary": "266 85% 58%" }, {});
    expect(localStorage.getItem("hrt-theme-id")).toBe("my-theme-id");
  });

  it("writes hrt-theme-css to localStorage", () => {
    applyTheme("my-theme-id", { "--primary": "266 85% 58%" }, {});
    expect(localStorage.getItem("hrt-theme-css")).toContain(
      "--primary: 266 85% 58%;"
    );
  });

  it("handles a missing #hrt-theme-inline element gracefully", () => {
    document.head.replaceChildren();
    expect(() =>
      applyTheme("test-id", { "--primary": "266 85% 58%" }, {})
    ).not.toThrow();
  });
});

// ─── clearTheme ───────────────────────────────────────────────────────────────

describe("clearTheme", () => {
  beforeEach(() => {
    const style = setupStyleElement();
    style.textContent = ":root { --primary: 266 85% 58%; }";
    localStorage.setItem("hrt-theme-id", "existing-id");
    localStorage.setItem("hrt-theme-css", ":root { --primary: 266 85% 58%; }");
  });

  it("empties #hrt-theme-inline textContent", () => {
    clearTheme();
    expect(document.getElementById("hrt-theme-inline")?.textContent).toBe("");
  });

  it("removes hrt-theme-id from localStorage", () => {
    clearTheme();
    expect(localStorage.getItem("hrt-theme-id")).toBeNull();
  });

  it("removes hrt-theme-css from localStorage", () => {
    clearTheme();
    expect(localStorage.getItem("hrt-theme-css")).toBeNull();
  });

  it("handles a missing #hrt-theme-inline element gracefully", () => {
    document.head.replaceChildren();
    expect(() => clearTheme()).not.toThrow();
  });
});
