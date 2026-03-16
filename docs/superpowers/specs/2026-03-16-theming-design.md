# Theming System Design
**Date:** 2026-03-16
**Status:** Approved

## Overview

A multi-level theming system supporting built-in classic themes, company-defined themes (multiple per org), and user-defined themes. Themes are stored as JSON (CSS variable maps), applied via server-injected `<style>` block, cached in-memory server-side and in localStorage client-side to prevent FOUC.

---

## 1. Data Model

### New `Theme` table

```prisma
model Theme {
  id          String    @id @default(cuid())
  name        String
  slug        String    @unique
  type        ThemeType
  cssVars     Json      // { "--primary": "217 91% 60%", ... }
  darkCssVars Json?     // optional dark-mode overrides
  userId      String?
  user        User?     @relation(fields: [userId], references: [id])
  createdAt   DateTime  @default(now())
}

enum ThemeType {
  BUILTIN
  COMPANY
  USER
}
```

### `AppSetting` additions

Two new keys managed by `appSettingService`:
- `defaultTheme` — slug of the org-wide default theme
- `lockTheme` — `"true"/"false"`, prevents user overrides when true

### `User` model addition

```prisma
themeId  String?
theme    Theme?  @relation(fields: [themeId], references: [id])
```

---

## 2. Theme Sources

### Built-in themes (shipped with app)

Defined as JSON files in `lib/themes/builtins/`. Seeded via `ensureBuiltinThemes()` on startup. Initial set:

| Slug | Name | Audience |
|------|------|----------|
| `default` | Default | Current app colours |
| `catppuccin-latte` | Catppuccin Latte | Developers |
| `catppuccin-mocha` | Catppuccin Mocha | Developers |
| `gruvbox` | Gruvbox | Developers |
| `rose-pine` | Rosé Pine | Developers |
| `nord` | Nord | Developers |
| `slate` | Slate | Office / neutral |
| `ocean` | Ocean | Office / calm |
| `warm` | Warm | Office / parchment |
| `high-contrast` | High Contrast | Accessibility |

### Docker file-based themes

`THEME_FILE=/path/to/theme.json` env var. On startup, app reads the file and upserts it as a `COMPANY` theme. Allows Docker Compose deployments to supply a branded theme without touching the database. File format matches shadcn/tweakcn CSS export.

### Admin-created company themes

Admin pastes CSS or JSON from [ui.shadcn.com/themes](https://ui.shadcn.com/themes) or [tweakcn.com](https://tweakcn.com) into the App Settings UI. Parsed, sanitised, saved as `COMPANY` type. Multiple company themes can exist; one is marked as the org default.

### User-created themes

Same paste mechanism in the user's Profile → Appearance page. Saved as `USER` type scoped to that user. Shown below prebuilt/company themes in the picker. Requires `lockTheme = false`.

---

## 3. Theme Resolution

Evaluated server-side on each request using the session:

```
if lockTheme == true  → use org defaultTheme
else if user.themeId  → use user's theme
else if defaultTheme  → use org default
else                  → use built-in "default"
```

---

## 4. Application Mechanism

The root layout (`app/layout.tsx`) resolves the active theme server-side and:

1. Injects `<style id="hrt-theme">:root { --primary: ...; ... } .dark { ... }</style>` into `<head>`
2. Injects a tiny inline `<script>` that reads `localStorage["hrt-theme-css"]` and applies it before hydration to prevent FOUC — same pattern next-themes uses for dark mode

Dark mode continues to be handled by next-themes via the `.dark` class on `<html>`. The `darkCssVars` from the active theme override the built-in dark values when present.

---

## 5. Caching

### Server-side
`themeService` holds a `Map<string, string>` of theme ID → rendered CSS string. Populated on first resolve, invalidated on any theme write (create/update/delete). Eliminates DB hits on subsequent page loads.

### Client-side
Two localStorage keys:
- `hrt-theme-id` — ID of the last applied theme
- `hrt-theme-css` — full rendered CSS string

Inline `<script>` in `<head>` checks if `hrt-theme-id` matches the SSR-injected theme ID. If it matches, applies immediately from localStorage before hydration. If it doesn't match (theme changed), applies the SSR-injected CSS and updates localStorage.

---

## 6. Input Parsing & Sanitisation

Accepts two paste formats:

**CSS block** (shadcn export):
```css
:root { --primary: 217 91% 60%; --background: 0 0% 100%; }
.dark { --primary: 217 91% 70%; }
```

**JSON** (tweakcn export):
```json
{ "primary": "217 91% 60%", "background": "0 0% 100%" }
```

**Sanitisation rules:**
- Variable names must match `/^--[a-z][a-z0-9-]*$/`
- Only known shadcn variable names are accepted (allowlist); unknown vars dropped silently
- Values must match HSL pattern `/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/` or a safe CSS value allowlist (for radius, etc.)
- Max 50 variables accepted

---

## 7. UI Surfaces

### Admin → App Settings → Themes tab
- List of company themes (name, type badge, active indicator)
- Set org default, toggle theme lock
- "Add Theme" — opens paste dialog (CSS or JSON input), live preview, save
- Delete company/built-in overrides

### User → Profile → Appearance
- Theme picker grid: built-in themes first, then company themes, then user's own custom themes
- Colour swatch previews for each option
- "Custom" option at bottom — expands paste input (same sanitisation)
- Live preview panel before committing

### Live preview (both UIs)
Mini mockup rendered with the pending theme applied: shows primary button, card, badge, and sidebar nav colours. Applied via a scoped `<div>` with inline CSS vars, not affecting the rest of the page.

---

## 8. New Files / Changes Summary

| Path | Action |
|------|--------|
| `prisma/schema.prisma` | Add `Theme` model, `ThemeType` enum, `User.themeId` |
| `lib/themes/builtins/*.json` | Built-in theme definitions |
| `lib/themes/themeParser.ts` | CSS/JSON input parsing + sanitisation |
| `lib/services/themeService.ts` | CRUD + resolution + in-memory cache |
| `app/api/themes/route.ts` | GET (list), POST (create) |
| `app/api/themes/[id]/route.ts` | PUT (update), DELETE |
| `app/api/themes/active/route.ts` | GET resolved theme for current user |
| `app/layout.tsx` | Server-side theme injection + FOUC script |
| `components/theme-script.tsx` | Inline script component for FOUC prevention |
| `app/admin/settings/themes/` | Admin themes tab UI |
| `app/profile/appearance/` | User appearance settings UI |
| `components/theme-picker.tsx` | Shared picker grid component |
| `components/theme-preview.tsx` | Live preview mini-mockup component |
| `components/theme-paste-dialog.tsx` | Paste input + parse + preview dialog |
