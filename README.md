# HRT Improved

An employee training and licence tracking system. Keeps records of which training courses employees have completed, what licences/tickets they hold, and which ones they're required to have based on their department and location.

## Features

- Training records (internal courses, external certifications, SOPs) with document/image uploads
- Licence and ticket records with expiry dates and renewal tracking
- Per-department/location training and ticket requirements
- Exemptions for employees who don't need specific items
- Reporting: completion rates, upcoming expirations, compliance gaps, needs analysis
- Bulk training entry across multiple employees at once
- Role-based access — Admins, Department Managers, Fire Wardens, and standard users
- User-to-employee matching with configurable strategies (email template, exact name, fuzzy name)

## Tech stack

- **Next.js 16** (App Router) with TypeScript
- **Prisma 7** with SQLite via `better-sqlite3`
- **better-auth** for authentication (Microsoft Entra ID / Azure AD)
- **shadcn/ui** + Tailwind CSS v4

## Prerequisites

- Node.js 20+
- pnpm
- A Microsoft Entra ID (Azure AD) app registration

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`. The required values are:

| Variable | Description |
|---|---|
| `AUTH_MICROSOFT_ENTRA_ID_ID` | Application (client) ID from Azure |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | Client secret |
| `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | `https://login.microsoftonline.com/<tenant-id>/v2.0` |
| `DATABASE_URL` | `file:./prisma/dev.db` works for local dev |
| `NEXT_PUBLIC_COMPANY_NAME` | Your organisation name (shown in the UI) |
| `NEXT_PUBLIC_COMPANY_DOMAIN_EXTENSION` | Email domain, e.g. `acmecorp.com.au` |
| `NEXT_PUBLIC_CONTACT_*` | IT contact details shown to users who need help |

### 3. Set up the database

```bash
pnpm prisma db push
pnpm prisma db seed
```

The seed creates ~50 demo employees across departments and locations, training courses, licence types, requirements, sample records, and placeholder images in the `uploads/` directory.

### 4. Run the dev server

```bash
pnpm dev
```

## First login and admin access

Auth is handled via Microsoft Entra ID — there are no local passwords. When you first sign in, your account is created with the default `User` role.

To give yourself Admin access, open Prisma Studio while the app is stopped and update your user's `role` field:

```bash
pnpm prisma studio
```

Find your user in the `User` table and set `role` to `Admin`. After that you can manage other users from the app's permissions page.

## Microsoft Entra setup

Create an app registration in the Azure portal and add the following as a redirect URI:

```
http://localhost:3000/api/auth/callback/microsoft
```

Replace `localhost:3000` with your domain for production deployments. The app needs the `User.Read` scope at minimum.

## File uploads

Uploaded images and PDFs are stored in an `uploads/` directory at the project root (gitignored). In production you'll want to mount a persistent volume or swap out the file storage to something like S3.

## Resetting the demo database

```bash
pnpm prisma db push --force-reset
pnpm prisma db seed
```

## SSO gateway (Caddy forward_auth)

HRT acts as a shared SSO gateway for other internal apps on the same Caddy server. All of those apps can rely on HRT's session cookie (which is set on the `.ksb.com.au` parent domain) and have Caddy inject authenticated user details as request headers — no auth code needed in the downstream apps.

### How it works

1. Browser hits `helm.ksb.com.au/something`, carrying the HRT session cookie.
2. Caddy calls `hrt.ksb.com.au/api/auth/validate` with the original cookies forwarded.
3. If the session is valid, HRT returns 200 and Caddy copies `X-User-*` headers into the proxied request to the downstream app.
4. If there is no valid session, HRT returns 401 with a `Location` header pointing to `hrt.ksb.com.au/auth?redirect=https://helm.ksb.com.au/something`. Caddy passes the 401 through; a `handle_errors` block redirects the browser to the login page.
5. After Microsoft SSO, better-auth redirects the browser to the original app URL stored in `?redirect=`.

### Caddy configuration

```caddy
# Reusable snippet — define once, import in each app block.
(hrt_auth) {
    forward_auth hrt.ksb.com.au {
        uri /api/auth/validate
        copy_headers X-User-Id X-User-Name X-User-Email X-User-Role
    }
}

helm.ksb.com.au {
    import hrt_auth

    # On auth failure Caddy passes through the 401 + Location header.
    # This handle_errors block turns it into a browser redirect.
    handle_errors 401 {
        redir {header.Location} 302
    }

    reverse_proxy localhost:5173
}

tools.ksb.com.au {
    import hrt_auth

    handle_errors 401 {
        redir {header.Location} 302
    }

    reverse_proxy localhost:5174
}
```

> **Note:** Caddy's `forward_auth` reads `X-Forwarded-Host` and `X-Forwarded-Uri` automatically. HRT's validate endpoint uses those headers to build the `?redirect=` URL, so no extra configuration is needed for the post-login redirect to work.

### Adding a new app to the gateway

1. Add its origin to `trustedOrigins` in `lib/auth.ts`.
2. Add a Caddy block for the new domain following the pattern above.
3. The downstream Vite app reads `X-User-Id`, `X-User-Name`, `X-User-Email`, and `X-User-Role` from incoming request headers — no auth library required.

### Security notes

- The `?redirect=` parameter (both in the query string and derived from forwarded headers) is validated server-side: only `https://*.ksb.com.au` URLs are accepted.
- Downstream apps must trust the `X-User-*` headers only when they arrive via Caddy on the internal network. Strip these headers from any requests that don't come through Caddy.
- Downstream apps should not be directly accessible from the internet — they should only be reachable through Caddy.
