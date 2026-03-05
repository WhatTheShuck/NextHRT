import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AccessCheckAdminContent } from "./access-check-admin-content";
import { AccessCheckUserContent } from "./access-check-user-content";

export default async function AccessCheckPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return redirect("/auth");

  if (session.user.role === "Admin") {
    return <AccessCheckAdminContent />;
  }

  return <AccessCheckUserContent userId={session.user.id} />;
}
