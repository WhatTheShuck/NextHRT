import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PermissionPageContent } from "./permission-page-content";
import { headers } from "next/headers";

export default async function PermissionPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session?.user?.role === "Admin") {
    return <PermissionPageContent />;
  }

  return <p>You are not authorised to view this page!</p>;
}
