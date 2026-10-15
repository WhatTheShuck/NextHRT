import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ImportUploadContent } from "./import-upload-content";

export default async function WorkdayImportPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");
  if (session.user?.role !== "Admin") redirect("/");

  return <ImportUploadContent />;
}
