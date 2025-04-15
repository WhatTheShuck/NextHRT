"use client";
import React, { useEffect } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { companyDetails } from "@/lib/data";

const LoginPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to homepage if already authenticated
  useEffect(() => {
    if (status === "authenticated" && session) {
      router.push("/");
    }
  }, [session, status, router]);

  // Handle Microsoft sign-in
  const handleMicrosoftSignIn = () => {
    signIn("azure-ad", { callbackUrl: "/" });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        {/* Logo and Company Name */}
        <div className="text-center mb-8">
          <Building2 className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-3xl font-bold">
            {companyDetails.name || "HR Portal"}
          </h1>
          <p className="mt-2">
            Welcome! Please sign in with your company account.
          </p>
        </div>

        {/* Login Card */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Access the portal using your Microsoft account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-center text-muted-foreground">
              Click the button below to sign in with your company Microsoft
              account
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
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
};

export default LoginPage;
