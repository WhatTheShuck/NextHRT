import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { OnboardingForm } from "@/components/forms/onboarding-form";

export default async function NewEmployeePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { employeeId: true },
  });

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
        userRole={session.user.role as import("@/generated/prisma_client/client").UserRole ?? null}
      />
    </div>
  );
}
