import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { MyRequestsContent } from "./my-requests-content";

export default async function MyRequestsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");

  return <MyRequestsContent />;
}
