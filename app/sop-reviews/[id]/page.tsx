import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { MarkingContent } from "./marking-content";

export default async function SopMarkingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return redirect("/auth");

  const { id } = await params;
  return <MarkingContent assessmentId={parseInt(id)} />;
}
