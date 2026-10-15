import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { SwitchoverContent } from "./switchover-content";

export default async function SwitchoverPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");
  if (session.user?.role !== "Admin") redirect("/");

  return <SwitchoverContent />;
}
