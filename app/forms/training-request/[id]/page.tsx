import { TrainingRequestStatusContent } from "./training-request-status-content";

export default async function TrainingRequestStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TrainingRequestStatusContent requestId={Number(id)} />;
}
