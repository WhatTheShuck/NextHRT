// lib/themes/__tests__/themeParser.test.ts
import { describe, it, expect } from "vitest";
import { parseThemeInput } from "@/lib/themes/themeParser";

describe("parseThemeInput — CSS format", () => {
  it("accepts a bare HSL triplet", () => {
    const result = parseThemeInput(":root { --primary: 266 85% 58%; }");
    expect(result.cssVars["--primary"]).toBe("266 85% 58%");
  });

  it("strips the hsl() wrapper and stores bare triplet", () => {
    const result = parseThemeInput(
      ":root { --primary: hsl(266.0440 85.0467% 58.0392%); }"
    );
    expect(result.cssVars["--primary"]).toBe("266.0440 85.0467% 58.0392%");
  });

  it("accepts decimal HSL values without hsl() wrapper", () => {
    const result = parseThemeInput(":root { --primary: 266.04 85.05% 58.04%; }");
    expect(result.cssVars["--primary"]).toBe("266.04 85.05% 58.04%");
  });

  it("strips alpha component from hsl() / syntax", () => {
    const result = parseThemeInput(
      ":root { --primary: hsl(266 85% 58% / 0.5); }"
    );
    expect(result.cssVars["--primary"]).toBe("266 85% 58%");
  });

  it("extracts :root vars into cssVars", () => {
    const result = parseThemeInput(":root { --background: 0 0% 100%; }");
    expect(result.cssVars["--background"]).toBe("0 0% 100%");
  });

  it("extracts .dark vars into darkCssVars", () => {
    const result = parseThemeInput(
      ":root { --primary: 220 91% 54%; } .dark { --primary: 267 84% 81%; }"
    );
    expect(result.cssVars["--primary"]).toBe("220 91% 54%");
    expect(result.darkCssVars["--primary"]).toBe("267 84% 81%");
  });

  it("silently drops unknown vars like --sidebar", () => {
    const result = parseThemeInput(
      ":root { --primary: 266 85% 58%; --sidebar: 0 0% 100%; }"
    );
    expect(result.cssVars["--primary"]).toBe("266 85% 58%");
    expect(result.cssVars["--sidebar"]).toBeUndefined();
  });

  it("silently drops invalid values like hex colours", () => {
    const result = parseThemeInput(
      ":root { --primary: 266 85% 58%; --background: #ffffff; }"
    );
    expect(result.cssVars["--primary"]).toBe("266 85% 58%");
    expect(result.cssVars["--background"]).toBeUndefined();
  });

  it("silently drops rgba() values", () => {
    const result = parseThemeInput(
      ":root { --primary: 266 85% 58%; --card: rgba(255,255,255,1); }"
    );
    expect(result.cssVars["--card"]).toBeUndefined();
  });

  it("accepts a valid --radius length in rem", () => {
    const result = parseThemeInput(
      ":root { --primary: 266 85% 58%; --radius: 0.5rem; }"
    );
    expect(result.cssVars["--radius"]).toBe("0.5rem");
  });

  it("accepts a valid --radius length in px", () => {
    const result = parseThemeInput(
      ":root { --primary: 266 85% 58%; --radius: 4px; }"
    );
    expect(result.cssVars["--radius"]).toBe("4px");
  });

  it("silently drops an invalid --radius value", () => {
    const result = parseThemeInput(
      ":root { --primary: 266 85% 58%; --radius: red; }"
    );
    expect(result.cssVars["--radius"]).toBeUndefined();
  });

  it("handles a full tweakcn paste with @import and @theme blocks", () => {
    const input = `
      @import "tailwindcss";
      @custom-variant dark (&:is(.dark *));
      :root {
        --background: hsl(220.0000 23.0769% 94.9020%);
        --primary: hsl(266.0440 85.0467% 58.0392%);
        --radius: 0.35rem;
      }
      .dark {
        --background: hsl(240 21.3115% 11.9608%);
        --primary: hsl(267.4074 83.5052% 80.9804%);
      }
      @theme inline { --color-primary: var(--primary); }
    `;
    const result = parseThemeInput(input);
    expect(result.cssVars["--background"]).toBe("220.0000 23.0769% 94.9020%");
    expect(result.cssVars["--primary"]).toBe("266.0440 85.0467% 58.0392%");
    expect(result.cssVars["--radius"]).toBe("0.35rem");
    expect(result.darkCssVars["--primary"]).toBe("267.4074 83.5052% 80.9804%");
  });
});

describe("parseThemeInput — JSON format", () => {
  it("parses cssVars / darkCssVars structure", () => {
    const input = JSON.stringify({
      name: "Test",
      cssVars: { "--primary": "266 85% 58%" },
      darkCssVars: { "--primary": "267 84% 81%" },
    });
    const result = parseThemeInput(input);
    expect(result.cssVars["--primary"]).toBe("266 85% 58%");
    expect(result.darkCssVars["--primary"]).toBe("267 84% 81%");
  });

  it("parses a flat object as light vars", () => {
    const input = JSON.stringify({ "--primary": "266 85% 58%" });
    const result = parseThemeInput(input);
    expect(result.cssVars["--primary"]).toBe("266 85% 58%");
    expect(Object.keys(result.darkCssVars)).toHaveLength(0);
  });

  it("sanitises JSON values (drops unknown keys)", () => {
    const input = JSON.stringify({
      cssVars: { "--primary": "266 85% 58%", "--sidebar": "0 0% 100%" },
    });
    const result = parseThemeInput(input);
    expect(result.cssVars["--sidebar"]).toBeUndefined();
  });

  it("throws a descriptive error on invalid JSON", () => {
    expect(() => parseThemeInput("{not: valid}")).toThrow();
  });
});

describe("parseThemeInput — error cases", () => {
  it("throws on empty input", () => {
    expect(() => parseThemeInput("")).toThrow("Input is empty");
  });

  it("throws when no known vars survive sanitisation", () => {
    expect(() =>
      parseThemeInput(":root { --unknown-thing: foo; --sidebar: 0 0% 100%; }")
    ).toThrow("No valid CSS variables found");
  });
});
