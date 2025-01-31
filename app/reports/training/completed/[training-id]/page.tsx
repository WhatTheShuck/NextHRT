// app/reports/training/completed/[trainingId]/page.tsx
"use client";

import { useParams } from "next/navigation";
import TrainingCompletionTable from "@/components/TrainingCompletionTable";

export default function CompletedTrainingByIdPage() {
  const params = useParams();
  const trainingId = Number(params.trainingId);

  console.log("Params:", params);
  console.log("Training ID:", trainingId);

  if (!trainingId) {
    return (
      <div className="container mx-auto py-8">No training ID provided</div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <TrainingCompletionTable trainingId={trainingId} />
    </div>
  );
}
