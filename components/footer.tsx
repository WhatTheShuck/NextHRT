import { contactDetails } from "@/lib/data";
import { Phone, Mail } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const Footer = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <footer className="bg-background border-t border-border">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <p className="text-center text-muted-foreground text-sm">
              Need help? <TooltipTrigger>Contact IT Support</TooltipTrigger>
            </p>
            <TooltipContent>
              <ul className="space-y-2">
                <li>Contact: {contactDetails.name}</li>
                <li>Role: {contactDetails.role}</li>
                <li className="flex items-center gap-2">
                  <Phone size={16} />
                  <a
                    href={`tel:${contactDetails.phoneNumber.replace(/[^\d+]/g, "")}`}
                    className="hover:underline"
                  >
                    {contactDetails.phoneNumber}
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail size={16} />
                  <a
                    href={`mailto:${contactDetails.emailAdress}`}
                    className="hover:underline"
                  >
                    {contactDetails.emailAdress}
                  </a>
                </li>
              </ul>
            </TooltipContent>
          </div>
        </footer>
      </Tooltip>
    </TooltipProvider>
  );
};

export default Footer;
