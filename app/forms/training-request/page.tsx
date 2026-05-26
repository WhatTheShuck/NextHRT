import { TrainingRequestForm } from "@/components/forms/training-request-form";

export default function TrainingRequest() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-4xl font-bold">Training Request Form</h1>
      <TrainingRequestForm />
    </div>
  );
}
