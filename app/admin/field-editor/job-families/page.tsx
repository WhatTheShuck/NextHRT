import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import JobFamilyDirectory from "./job-family-directory";

export default async function JobFamiliesPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <JobFamilyDirectory />
    </div>
  );
}
