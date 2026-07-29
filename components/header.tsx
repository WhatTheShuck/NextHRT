import Image from "next/image";
import Link from "next/link";
import { companyDetails } from "@/lib/data";
import { ModeToggle } from "./theme-toggle";
import { ProfileButton } from "./ProfileButton";
import { HeaderShell } from "./header-shell";

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
        <span className="text-xl font-bold text-foreground">Next HRT</span>
      </Link>

      {/* Right side controls */}
      <div className="flex items-end gap-4">
        <ModeToggle />
        <ProfileButton />
      </div>
    </HeaderShell>
  );
};

export default Header;
