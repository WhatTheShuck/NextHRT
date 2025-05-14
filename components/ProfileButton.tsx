import { auth } from "@/lib/auth";
import Link from "next/link";
import { SignOut } from "@/components/sign-out";
import { UserIcon, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export async function ProfileButton() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Button variant="outline" asChild>
        <Link href="/login">
          <UserIcon className="h-4 w-4 mr-2" />
          Login
        </Link>
      </Button>
    );
  }
  // Get initials for the avatar fallback
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "";
    const nameParts = name.split(" ");
    return `${nameParts[0]?.[0] || ""}${nameParts[1]?.[0] || ""}`.toUpperCase();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="rounded-full p-0 h-10 w-10">
          <Avatar>
            <AvatarImage
              src={session.user.image || ""}
              alt={session.user.name || "Profile"}
            />
            <AvatarFallback className="bg-green-600 text-white">
              {getInitials(session.user.name)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{session.user.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {session.user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/profile"
            className="flex w-full items-center cursor-pointer"
          >
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex w-full items-center cursor-pointer"
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <SignOut />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
