import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import UserProfileDetails from "./profile-details";
import { AppearanceSettings } from "./appearance-settings";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { appSettingService } from "@/lib/services/appSettingService";

async function Profile() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) return redirect("/auth");

  const [dbUser, settings] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id }, select: { themeId: true } }),
    appSettingService.getSettings(),
  ]);

  const locked = settings["theme.lock"] === "true";
  const currentThemeId = dbUser?.themeId ?? null;

  return (
    <div className="flex items-center justify-center min-h-[90vh] p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Main Profile Card - Server Side */}
        <Card className="shadow-lg">
          <CardContent className="p-0">
            {/* Header Section */}
            <div className="bg-linear-to-r from-blue-500 to-purple-600 rounded-t-lg p-5 md:p-8 text-white">
              <div className="flex flex-col items-center space-y-3 md:space-y-4">
                <Avatar className="w-16 h-16 md:w-24 md:h-24 border-4 border-white shadow-lg">
                  <AvatarImage
                    src={session.user.image || ""}
                    alt={session.user.name || ""}
                  />
                  <AvatarFallback className="bg-white text-purple-600 text-xl md:text-2xl font-bold">
                    {session.user.name?.charAt(0).toUpperCase()}
                    {session.user.name?.split(" ")[1]?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center px-2">
                  <h1 className="text-xl md:text-3xl font-bold break-words">{session.user.name}</h1>
                  <p className="text-blue-100 text-sm md:text-lg break-all">{session.user.email}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <UserProfileDetails userId={session.user.id} />

        <Card className="shadow-lg">
          <CardContent className="p-5 md:p-8">
            <h2 className="text-lg font-semibold mb-6">Appearance</h2>
            <AppearanceSettings currentThemeId={currentThemeId} locked={locked} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Profile;
