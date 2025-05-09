"use client";
import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Lock } from "lucide-react";
import Link from "next/link";
import { companyDetails } from "@/lib/data";

const LoginPage = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        {/* Logo and Company Name */}
        <div className="text-center mb-8">
          <Building2 className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-3xl font-bold ">HR Portal</h1>
          <p className="mt-2">Welcome back! Please log in to continue.</p>
        </div>

        {/* Login Card */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Login</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <form>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={`name@${companyDetails.domain_extension}`}
                  required
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Input type="checkbox" id="remember" className="h-4 w-4" />
                  <Label htmlFor="remember" className="text-sm">
                    Remember me
                  </Label>
                </div>
                <Button variant="link" className="text-sm text-primary">
                  Forgot password?
                </Button>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={"/"} className="w-full">
                <Button type="submit" className="w-full">
                  <Lock className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
