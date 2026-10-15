// Dev-only email/password sign-in, so the app can be exercised locally without
// a Microsoft account. Requires BOTH a development build and an explicit opt-in;
// `next build` always sets NODE_ENV=production, so this is dead in any deploy
// regardless of env vars. NEXT_PUBLIC_ so the login page can read it too.
export const devAuthEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_DEV_AUTH === "true";

// Seeded by `pnpm dev:auth`, one per role; listed as quick-pick buttons on /auth.
export const DEV_PERSONAS = [
  { email: "dev-admin@dev.local", name: "Dev Admin", role: "Admin" },
  { email: "dev-manager@dev.local", name: "Dev Manager", role: "DepartmentManager" },
  { email: "dev-warden@dev.local", name: "Dev Warden", role: "FireWarden" },
  { email: "dev-user@dev.local", name: "Dev User", role: "User" },
] as const;
