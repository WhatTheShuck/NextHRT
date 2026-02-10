import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TicketsDirectory from "./tickets-directory";
import { headers } from "next/headers";

export default async function TicketsDirectoryPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }
  return (
    <div className="container mx-auto py-8">
      <TicketsDirectory />
    </div>
  );
}
