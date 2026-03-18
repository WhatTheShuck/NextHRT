import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/footer";
import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import ConditionalBreadcrumbs from "@/components/conditional-breadcrumbs";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { themeService } from "@/lib/services/themeService";
import { appSettingService } from "@/lib/services/appSettingService";
import { ThemeScript } from "@/components/theme-script";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Next HRT",
  description: "The Next Human Resources and Training",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Idempotent — upserts builtins on cold start, skips if already seeded
  await themeService.ensureBuiltins();
  await themeService.loadDockerTheme();

  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

  const settings = await appSettingService.getSettings();
  const defaultThemeSlug = settings["theme.default"] ?? "default";
  const lockTheme = settings["theme.lock"] === "true";

  let userThemeId: string | null = null;
  if (session?.user?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { themeId: true },
    });
    userThemeId = dbUser?.themeId ?? null;
  }

  const activeTheme = await themeService.resolveActiveTheme({
    userId: session?.user?.id,
    userThemeId,
    defaultThemeSlug,
    lockTheme,
  });
  const themeCss = themeService.getCss(activeTheme);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Safe: rendered from sanitised CSS var values; see security note in plan header */}
        <style id="hrt-theme-inline" dangerouslySetInnerHTML={{ __html: themeCss }} />
        <ThemeScript themeId={activeTheme.id} themeCss={themeCss} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Header />
          <ConditionalBreadcrumbs />
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
