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
