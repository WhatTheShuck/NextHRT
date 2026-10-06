import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { NavigationCard } from "@/components/navigation-card";
import { emailNavigationItems } from "@/lib/data";
import { emailLogService } from "@/lib/services/emailLogService";
import { onboardingConfigService } from "@/lib/services/onboardingConfigService";

export default async function EmailPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  if (session.user?.role !== "Admin") {
    redirect("/");
  }

  const [stats, staleEmails] = await Promise.all([
    emailLogService.stats(),
    onboardingConfigService.findStaleComplianceEmails(),
  ]);

  // Surface problems on the card that fixes them.
  const badges: Record<string, number> = {
    "/admin/email/log": stats.failed,
    "/admin/email/attachments": staleEmails.length,
  };

  const statCards = [
    { label: "Sent in the last 7 days", value: stats.sentLast7Days },
    { label: "Queued or scheduled", value: stats.queued },
    { label: "Failed", value: stats.failed, alert: stats.failed > 0 },
    {
      label: "Waiting on missing attachments",
      value: staleEmails.length,
      alert: staleEmails.length > 0,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-screen-2xl mx-auto space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold">Email</h1>
          <p className="text-muted-foreground mt-2">
            Everything about the emails HRT sends — wording, delivery history,
            and fixing ones that didn&apos;t go out.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {emailNavigationItems.map((item) => (
            <NavigationCard key={item.href} {...item} badge={badges[item.href]} />
          ))}
        </div>

        <div className="space-y-4">
          <h2 className="text-xl md:text-2xl font-semibold">At a glance</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map(({ label, value, alert }) => (
              <div key={label} className="bg-card p-5 rounded-lg border space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
                <p className={`text-3xl font-bold ${alert ? "text-destructive" : ""}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
