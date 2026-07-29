import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { MySopsPageContent } from "./my-sops-page-content";

export default async function MySopsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return redirect("/auth");

  return <MySopsPageContent />;
}
