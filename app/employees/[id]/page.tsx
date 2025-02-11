// app/employees/[id]/page.tsx
import { EmployeeProfile } from "./components/employee-profile";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import api from "@/lib/axios";

export default async function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: initialEmployeeData } = await api.get(
    `/api/employees/${params.id}`,
  );

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <EmployeeProfile
        initialEmployee={initialEmployeeData}
        initialTrainingRecords={initialEmployeeData.TrainingRecords}
        employeeId={parseInt(params.id)}
      />
    </Suspense>
  );
}
