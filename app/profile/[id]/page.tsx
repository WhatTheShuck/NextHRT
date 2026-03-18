import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import UserProfileDetails from "../profile-details";
import MainProfileCard from "./main-profile-card";
interface ProfileByIdProps {
  params: Promise<{ id: string }>;
}

export default async function ProfileById({ params }: ProfileByIdProps) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/auth");
  const userId = (await params).id;
  if (session?.user?.role === "Admin") {
    return (
      <div className="flex items-center justify-center min-h-[90vh] p-4">
        <div className="w-full max-w-2xl space-y-6">
          {/* Main Profile Card */}
          <MainProfileCard userId={userId} />

          {/* Enhanced User Details - Client Side Component */}
          <UserProfileDetails userId={userId} />
        </div>
      </div>
    );
  } else {
    return (
      <div className="flex items-center justify-center min-h-[90vh] p-4">
        <div className="w-full max-w-2xl space-y-6">
          Only admins can view the profile of other users!
        </div>
      </div>
    );
  }
}
