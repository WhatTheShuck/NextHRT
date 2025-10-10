import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@/generated/prisma_client";
import { nextCookies } from "better-auth/next-js";
const prisma = new PrismaClient();
export const auth = betterAuth({
  socialProviders: {
    microsoft: {
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID as string,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET as string,
      // Optional
      tenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID as string,
      authority: "https://login.microsoftonline.com", // Authentication authority URL
      prompt: "none", // "select_account" Forces account selection
    },
  },
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  plugins: [nextCookies()],
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
