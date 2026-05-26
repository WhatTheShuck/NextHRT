import { EmployeeRequestForm } from "@/components/forms/employee-request-form";

export default function TrainingRequest() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-4xl font-bold">New Employee Request Form</h1>
      <EmployeeRequestForm />
    </div>
  );
}
