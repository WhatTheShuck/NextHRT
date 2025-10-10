"use client";
import { useTransition } from "react";
import { signOut } from "@/lib/auth-client"; // Changed import
import { LogOut } from "lucide-react";

export function SignOut() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className="flex w-full items-center text-sm"
      onClick={() => startTransition(() => signOut())}
      disabled={isPending}
    >
      <LogOut className="mr-2 h-4 w-4" />
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
