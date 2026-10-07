import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { IgnoreRulesContent } from "./ignore-rules-content";

export default async function WorkdayIgnoreRulesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");
  if (session.user?.role !== "Admin") redirect("/");

  return <IgnoreRulesContent />;
}
