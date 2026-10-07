import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NavigationCard } from "@/components/navigation-card";
import { systemNavigationItems } from "@/lib/data";

export default async function SystemPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-screen-2xl mx-auto space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold">System</h1>
          <p className="text-muted-foreground mt-2">
            Application settings and the plumbing behind HRT — background jobs
            and logs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemNavigationItems.map((item) => (
            <NavigationCard key={item.href} {...item} />
          ))}
        </div>
      </div>
    </div>
  );
}
