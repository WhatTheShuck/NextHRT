import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserProfileDetails from "./profile-details";
import { headers } from "next/headers";

async function Profile() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  return (
    <div className="flex items-center justify-center min-h-[90vh] p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Main Profile Card - Server Side */}
        <Card className="shadow-lg">
          <CardContent className="p-0">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-t-lg p-8 text-white">
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                  <AvatarImage
                    src={session.user.image || ""}
                    alt={session.user.name || ""}
                  />
                  <AvatarFallback className="bg-white text-purple-600 text-2xl font-bold">
                    {session.user.name?.charAt(0).toUpperCase()}
                    {session.user.name?.split(" ")[1]?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h1 className="text-3xl font-bold">{session.user.name}</h1>
                  <p className="text-blue-100 text-lg">{session.user.email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <UserProfileDetails userId={session.user.id} />
      </div>
    </div>
  );
}

export default Profile;
