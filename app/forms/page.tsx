import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { FormPageContent } from "./formsContent";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClipboardList } from "lucide-react";

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8 pb-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Forms</h1>
            <p className="text-muted-foreground mt-2">
              View and fill out forms
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/forms/my-requests">
              <ClipboardList className="h-4 w-4 mr-2" />
              My Requests
            </Link>
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        <FormPageContent />
      </div>
    </div>
  );
}
