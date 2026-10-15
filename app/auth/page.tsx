import { Suspense } from "react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LoginPageContent } from "./auth-content";
import { headers } from "next/headers";
import { safeReturnPath } from "@/lib/auth-return";

const LoginPage = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const rt = (await searchParams).returnTo;
  if (session) redirect(safeReturnPath(typeof rt === "string" ? rt : null) ?? "/");

  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  );
};

export default LoginPage;
