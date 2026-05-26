"use client";
import React from "react";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client"; // Changed from next-auth/react
import { companyDetails } from "@/lib/data";

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

export function LoginPageContent() {
  const searchParams = useSearchParams();

  const handleMicrosoftSignIn = async () => {
    const redirect = searchParams.get("redirect");
    const callbackURL =
      redirect && isAllowedRedirect(redirect) ? redirect : "/";

    await signIn.social({
      provider: "microsoft",
      callbackURL,
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        {/* Logo and Company Name */}
        <div className="text-center mb-8">
          {/*<Building2 className="mx-auto h-12 w-12 text-primary" />*/}
          {/*<img
            src="/HRT Favicon - 32x32.png"
            alt="NextHRT Logo"
            className="mx-auto h-24 w-24 object-contain"
          />*/}
          <img
            src="/web-app-manifest-512x512.png"
            alt="NextHRT Logo"
            className="mx-auto"
          />
          {/*<h1 className="mt-4 text-3xl font-bold">{"NextHRT"}</h1>*/}
          <h1 className="mt-4 text-3xl font-bold">{companyDetails.name}</h1>
          <p className="mt-2">
            Welcome! Please sign in with your company account.
          </p>
        </div>

        {/* Login Card */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Access the portal using your company Microsoft account
            </CardDescription>
          </CardHeader>
          <CardFooter className="grid grid-cols-1 justify-center gap-y-2">
            <Button
              onClick={handleMicrosoftSignIn}
              className="w-full flex items-center justify-center"
            >
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
              Sign in with Microsoft
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
