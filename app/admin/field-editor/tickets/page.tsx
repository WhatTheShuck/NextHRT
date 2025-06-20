import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TicketsDirectory from "./tickets-directory";

export default async function TicketsDirectoryPage() {
  const session = await auth();
  // Redirect if not authenticated
  if (!session) {
    redirect("/auth");
  }

  if (session.user?.role !== "Admin") {
    redirect("/");
  }
  return (
    <div className="container mx-auto py-8">
      <TicketsDirectory />
    </div>
  );
}
