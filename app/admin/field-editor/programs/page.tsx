import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProgramDirectory from "./program-directory";
import { headers } from "next/headers";

export default async function ProgramDirectoryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <ProgramDirectory />
    </div>
  );
}
