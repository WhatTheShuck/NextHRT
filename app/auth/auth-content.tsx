"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";
import { companyDetails } from "@/lib/data";
import { Loader2 } from "lucide-react";

const MicrosoftLogo = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-5 w-5 mr-2"
    viewBox="0 0 23 23"
  >
    <path fill="#f3f3f3" d="M0 0h23v23H0z" />
    <path fill="#f35325" d="M1 1h10v10H1z" />
    <path fill="#81bc06" d="M12 1h10v10H12z" />
    <path fill="#05a6f0" d="M1 12h10v10H1z" />
    <path fill="#ffba08" d="M12 12h10v10H12z" />
  </svg>
);

function isAllowedRedirect(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" &&
      (hostname === "ksb.com.au" || hostname.endsWith(".ksb.com.au"))
    );
  } catch {
    return false;
  }
}

function getRedirectHost(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");
  const validRedirect =
    redirectParam && isAllowedRedirect(redirectParam) ? redirectParam : null;
  const redirectHost = validRedirect ? getRedirectHost(validRedirect) : null;

  const [autoSignInFailed, setAutoSignInFailed] = useState(false);
  const triggered = useRef(false);

  const doSignIn = async (callbackURL: string) => {
    await signIn.social({ provider: "microsoft", callbackURL });
  };

  // Auto-trigger SSO when arriving via a Caddy redirect
  useEffect(() => {
    if (!validRedirect || triggered.current) return;
    triggered.current = true;
    doSignIn(validRedirect).catch(() => setAutoSignInFailed(true));
  }, [validRedirect]);

  const handleMicrosoftSignIn = async () => {
    await doSignIn(validRedirect ?? "/");
  };

  const logo = (
    <img
      src="/web-app-manifest-512x512.png"
      alt="NextHRT Logo"
      className="mx-auto"
    />
  );

  // Auto-redirect loading screen
  if (validRedirect && !autoSignInFailed) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="w-full max-w-md px-4">
          <div className="text-center mb-8">{logo}</div>
          <Card className="w-full">
            <CardHeader className="text-center">
              <CardTitle>Signing you in</CardTitle>
              <CardDescription>
                {redirectHost
                  ? `We leverage HRT to sign you into your ${companyDetails.domain_extension} account. You'll be redirected to ${redirectHost} after sign-in.`
                  : "Please wait while we sign you in."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4 pb-6">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Connecting to Microsoft&hellip;
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Normal sign-in page (no redirect, or auto-sign-in failed)
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          {logo}
          <h1 className="mt-4 text-3xl font-bold">{companyDetails.name}</h1>
          <p className="mt-2">
            Welcome! Please sign in with your company account.
          </p>
        </div>

        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              {autoSignInFailed
                ? "Automatic sign-in failed. Please try again."
                : "Access the portal using your company Microsoft account"}
            </CardDescription>
          </CardHeader>
          <CardFooter className="grid grid-cols-1 justify-center gap-y-2">
            <Button
              onClick={handleMicrosoftSignIn}
              className="w-full flex items-center justify-center"
            >
              <MicrosoftLogo />
              Sign in with Microsoft
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
