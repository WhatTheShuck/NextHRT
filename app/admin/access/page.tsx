import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NavigationCard } from "@/components/navigation-card";
import { accessNavigationItems } from "@/lib/data";
import { accountOnboardingService } from "@/lib/services/accountOnboardingService";

export default async function AccessPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }

  const unlinkedUserCount = await accountOnboardingService.countUnlinkedUsers();

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-screen-2xl mx-auto space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold">Users &amp; Access</h1>
          <p className="text-muted-foreground mt-2">
            Who can do what in HRT, how people are linked to the org structure,
            and how external services connect.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accessNavigationItems.map((item) => (
            <NavigationCard
              key={item.href}
              {...item}
              badge={
                item.href === "/admin/permissions" ? unlinkedUserCount : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
