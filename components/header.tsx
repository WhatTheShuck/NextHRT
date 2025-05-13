import Image from "next/image";
import Link from "next/link";
import { companyDetails } from "@/lib/data";
import { ModeToggle } from "./theme-toggle";
import { ProfileButton } from "./ProfileButton";

const Header = async () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Image
            src={companyDetails.logoPath}
            alt={`${companyDetails.name} Logo`}
            width={48}
            height={48}
            className="h-12 w-auto"
          />
          <span className="text-xl font-bold text-foreground">Next HRT</span>
        </Link>

        {/* Right side controls */}
        <div className="flex items-end gap-4">
          <ModeToggle />
          <ProfileButton />
        </div>
      </div>
    </header>
  );
};

export default Header;
