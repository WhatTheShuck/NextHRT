import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma_client/client";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { apiKey } from "@better-auth/api-key";
import {
  ac,
  adminRole,
  departmentManagerRole,
  fireWardenRole,
  userRole,
} from "@/lib/permissions";
const dbUrl = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: dbUrl.replace(/^file:/, "") }),
});
export const auth = betterAuth({
  socialProviders: {
    microsoft: {
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID as string,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET as string,
      // Optional
      tenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID as string,
      authority: "https://login.microsoftonline.com", // Authentication authority URL
    },
  },
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  // Allow post-login redirect to other *.ksb.com.au apps (SSO gateway pattern)
  trustedOrigins: [
    "https://hrt.ksb.com.au",
    "https://helm.ksb.com.au",
    "https://tools.ksb.com.au",
    "https://checkout.ksb.com.au",
  ],
  advanced: {
    // Share the session cookie across all *.ksb.com.au subdomains so Caddy's
    // forward_auth can read it when validating requests to downstream apps.
    // Disabled locally — domain=.ksb.com.au cookies are invisible to localhost,
    // which causes the OAuth state cookie to be lost on the callback.
    ...(process.env.NODE_ENV === "production" && {
      crossSubDomainCookies: {
        enabled: true,
        domain: "ksb.com.au",
      },
    }),
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  plugins: [
    admin({
      ac,
      roles: {
        Admin: adminRole,
        DepartmentManager: departmentManagerRole,
        FireWarden: fireWardenRole,
        User: userRole,
      },
      defaultRole: "User",
    }),
    apiKey({ enableSessionForAPIKeys: true }),

    nextCookies(),
  ],
});
// export const { handlers, auth, signIn, signOut } = NextAuth({
//   adapter: PrismaAdapter(prisma),
//   session: {
//     strategy: "database",
//   },
//   providers: [
//     MicrosoftEntraID({
//       clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
//       clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
//       issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
//       // profile(profile) {
//       // return { role: profile.role ?? "user" };
//       // },
//     }),
//   ],
//   callbacks: {
//     authorized: async ({ auth }) => {
//       return !!auth;
//     },
//     session({ session, user }) {
//       session.user.role = user.role;
//       return session;
//     },
//   },
//   pages: {
//     signIn: "/auth",
//   },
//   secret: process.env.AUTH_SECRET,
// });
