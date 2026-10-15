import Image from "next/image";
import Link from "next/link";
import { companyDetails } from "@/lib/data";
import { ModeToggle } from "./theme-toggle";
import { ProfileButton } from "./ProfileButton";
import { HeaderShell } from "./header-shell";
import { SearchTrigger } from "./search/search-trigger";

const Header = async () => {
  return (
    <HeaderShell>
      {/* Logo and Brand */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <Image
          src={companyDetails.logoPath}
          alt={`${companyDetails.name} Logo`}
          width={48}
          height={48}
          className="h-12 w-auto"
        />
        {/* Hidden on phones to leave room for the search button */}
        <span className="hidden text-xl font-bold text-foreground sm:inline">
          Next HRT
        </span>
      </Link>

      {/* Search: a full-width box on desktop, an icon on mobile */}
      <div className="flex flex-1 justify-end px-2 md:justify-center md:px-8">
        <SearchTrigger />
      </div>

      {/* Right side controls */}
      <div className="flex items-end gap-4">
        <ModeToggle />
        <ProfileButton />
      </div>
    </HeaderShell>
  );
};

export default Header;
