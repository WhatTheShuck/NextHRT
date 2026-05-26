import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { NavigationItem } from "@/lib/types";
import Link from "next/link";

export const NavigationCard: React.FC<NavigationItem> = ({
  title,
  description,
  icon: Icon,
  href,
  badge,
}) => (
  <Link
    href={href}
    className="group hover:border-primary transition-colors cursor-pointer"
  >
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <span>{title}</span>
            {badge != null && badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-xs font-medium">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  </Link>
);
