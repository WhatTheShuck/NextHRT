import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrainingDirectory from "./training-directory";

export default async function TrainingDirectoryPage() {
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
      <TrainingDirectory />
    </div>
  );
}
