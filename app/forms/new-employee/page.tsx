import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { appSettingService } from "@/lib/services/appSettingService";
import prisma from "@/lib/prisma";
import { OnboardingForm } from "@/components/forms/onboarding-form";

export default async function NewEmployeePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  // Fetch settings and submitting user's linked employee in parallel.
  const [settings, user] = await Promise.all([
    appSettingService.getSettings(),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { employeeId: true },
    }),
  ]);

  const parseId = (val: string | undefined): number | null => {
    const n = parseInt(val ?? "");
    return Number.isFinite(n) ? n : null;
  };

  const jobFamilyIdServiceTechnician = parseId(
    settings["onboarding.jobFamily.serviceTechnician"],
  );
  const jobFamilyIdEngineering = parseId(
    settings["onboarding.jobFamily.engineering"],
  );
  const jobFamilyIdSalesMarketing = parseId(
    settings["onboarding.jobFamily.salesMarketing"],
  );

  return (
    <div className="max-w-3xl mx-auto min-h-screen bg-background px-4 p-8">
      <div>
        <h1 className="text-4xl font-bold">New Employee Onboarding</h1>
        <p className="text-muted-foreground mt-2">
          Submit a request to onboard a new hire. An admin will review and
          approve before the employee record is created.
        </p>
      </div>

      <OnboardingForm
        linkedEmployeeId={user?.employeeId ?? null}
        jobFamilyIdServiceTechnician={jobFamilyIdServiceTechnician}
        jobFamilyIdEngineering={jobFamilyIdEngineering}
        jobFamilyIdSalesMarketing={jobFamilyIdSalesMarketing}
      />
    </div>
  );
}
