"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";
import { DEV_PERSONAS } from "@/lib/dev-auth";

// Rendered only when devAuthEnabled — see lib/dev-auth.ts. Accounts and the
// shared password come from `pnpm dev:auth`.
export function DevSignIn({ callbackURL }: { callbackURL: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (asEmail: string) => {
    setPending(true);
    setError(null);
    const { error } = await signIn.email({ email: asEmail, password, callbackURL });
    if (error) {
      setError(`${error.message ?? "Sign-in failed"} — has \`pnpm dev:auth\` been run for this account?`);
      setPending(false);
    }
  };

  return (
    <div className="space-y-3 rounded-md border border-dashed border-amber-500 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
        Dev sign-in (local only)
      </p>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(email);
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="dev-email">Email</Label>
          <Input
            id="dev-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dev-admin@dev.local"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="dev-password">Password</Label>
          <Input
            id="dev-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={pending || !email}>
          Sign in with password
        </Button>
      </form>
      <div className="grid grid-cols-2 gap-2">
        {DEV_PERSONAS.map((p) => (
          <Button
            key={p.email}
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() => submit(p.email)}
          >
            {p.role}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
