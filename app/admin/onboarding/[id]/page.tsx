import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { OnboardingDetailContent } from "./onboarding-detail-content";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AdminOnboardingDetailPage({ params }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth");
  if (session.user?.role !== "Admin") redirect("/");

  const { id } = await params;
  const requestId = parseInt(id);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <OnboardingDetailContent requestId={requestId} />
    </div>
  );
}
