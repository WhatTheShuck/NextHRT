// Accepted CSS variable names — only the shadcn semantic tokens we override.
// Unknown variable names are dropped silently.
const ALLOWED_VARS = new Set([
  "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground",
  "--accent", "--accent-foreground",
  "--muted", "--muted-foreground",
  "--background", "--foreground",
  "--card", "--card-foreground",
  "--popover", "--popover-foreground",
  "--destructive", "--destructive-foreground",
  "--border", "--input", "--ring",
  "--radius",
  "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
]);

// Valid CSS values: HSL triplet (no hsl() wrapper), or a length for --radius
const HSL_PATTERN = /^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/;
const RADIUS_PATTERN = /^\d+(\.\d+)?(rem|px|em)$/;
const VAR_NAME_PATTERN = /^--[a-z][a-z0-9-]*$/;

function isValidValue(name: string, value: string): boolean {
  const v = value.trim();
  if (name === "--radius") return RADIUS_PATTERN.test(v);
  return HSL_PATTERN.test(v);
}

function sanitiseVars(raw: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  let count = 0;
  for (const [rawKey, rawVal] of Object.entries(raw)) {
    if (count >= 50) break;
    const key = rawKey.startsWith("--") ? rawKey : `--${rawKey}`;
    const val = String(rawVal).trim();
    if (!VAR_NAME_PATTERN.test(key)) continue;
    if (!ALLOWED_VARS.has(key)) continue;
    if (!isValidValue(key, val)) continue;
    result[key] = val;
    count++;
  }
  return result;
}

function parseCss(input: string): { light: Record<string, string>; dark: Record<string, string> } {
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  const rootMatch = input.match(/:root\s*\{([^}]*)\}/s);
  if (rootMatch) {
    for (const match of rootMatch[1].matchAll(/(-{2}[\w-]+)\s*:\s*([^;]+);/g)) {
      light[match[1].trim()] = match[2].trim();
    }
  }

  const darkMatch = input.match(/\.dark\s*\{([^}]*)\}/s);
  if (darkMatch) {
    for (const match of darkMatch[1].matchAll(/(-{2}[\w-]+)\s*:\s*([^;]+);/g)) {
      dark[match[1].trim()] = match[2].trim();
    }
  }

  // Fallback: no :root block found, treat whole input as a flat var list
  if (Object.keys(light).length === 0 && !darkMatch) {
    for (const match of input.matchAll(/(-{2}[\w-]+)\s*:\s*([^;]+);/g)) {
      light[match[1].trim()] = match[2].trim();
    }
  }

  return { light, dark };
}

function parseJson(input: string): { light: Record<string, string>; dark: Record<string, string> } {
  const parsed = JSON.parse(input) as Record<string, unknown>;
  const light: Record<string, string> = {};
  const dark: Record<string, string> = {};

  // Support { "primary": "..." } or { "cssVars": { ... }, "darkCssVars": { ... } }
  const lightSource = (parsed.cssVars ?? parsed) as Record<string, unknown>;
  const darkSource = (parsed.darkCssVars ?? {}) as Record<string, unknown>;

  for (const [k, v] of Object.entries(lightSource)) {
    if (typeof v === "string") light[k] = v;
  }
  for (const [k, v] of Object.entries(darkSource)) {
    if (typeof v === "string") dark[k] = v;
  }
  return { light, dark };
}

export interface ParsedTheme {
  cssVars: Record<string, string>;
  darkCssVars: Record<string, string>;
}

export function parseThemeInput(input: string): ParsedTheme {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Input is empty");

  let raw: { light: Record<string, string>; dark: Record<string, string> };

  if (trimmed.startsWith("{")) {
    try {
      raw = parseJson(trimmed);
    } catch {
      throw new Error("Invalid JSON — check your input and try again");
    }
  } else {
    raw = parseCss(trimmed);
  }

  const cssVars = sanitiseVars(raw.light);
  const darkCssVars = sanitiseVars(raw.dark);

  if (Object.keys(cssVars).length === 0 && Object.keys(darkCssVars).length === 0) {
    throw new Error(
      "No valid CSS variables found — ensure you are pasting from shadcn/ui or tweakcn.com"
    );
  }

  return { cssVars, darkCssVars };
}
