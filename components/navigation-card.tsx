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
}) => (
  <Link
    href={href}
    className="group hover:border-primary transition-colors cursor-pointer"
  >
    <Card className="">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <span>{title}</span>
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
