// app/employees/[id]/page.tsx
import EmployeeDetails from "./details-page";

export default function EmployeeDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <EmployeeDetails employeeId={parseInt(params.id)} />;
}
