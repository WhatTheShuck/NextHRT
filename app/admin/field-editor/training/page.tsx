import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrainingDirectory from "./training-directory";
import { headers } from "next/headers";

export default async function TrainingDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }
  const { q: rawQ } = await searchParams;
  const q = (Array.isArray(rawQ) ? rawQ[0] : rawQ) ?? "";
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      {/* ?q= comes from the search palette; keyed so a new query resets the filter */}
      <TrainingDirectory key={q} initialQuery={q} />
    </div>
  );
}
