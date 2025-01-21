"use client";
import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  ChevronRight,
  Users,
  ClipboardList,
  Settings,
  FileText,
  ShieldCheck,
  LucideIcon,
} from "lucide-react";

interface NavigationCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

const NavigationCard: React.FC<NavigationCardProps> = ({
  title,
  description,
  icon: Icon,
  href,
}) => (
  <Card className="group hover:border-primary transition-colors cursor-pointer">
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
);

const LandingPage: React.FC = () => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Welcome to Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Access and manage your resources from one central location
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={isAdmin}
              onCheckedChange={setIsAdmin}
              id="admin-mode"
            />
            <Label htmlFor="admin-mode">Admin Mode</Label>
          </div>
        </div>

        {/* Regular User Navigation */}
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <NavigationCard
              title="Reports"
              description="View and generate reports for your activities"
              icon={FileText}
              href="/reports"
            />
            <NavigationCard
              title="User Profile"
              description="View and edit your user information"
              icon={Users}
              href="/user/profile"
            />
            <NavigationCard
              title="Training Management"
              description="Add and manage training for multiple users"
              icon={ClipboardList}
              href="/training"
            />
          </div>
        </div>

        {/* Admin Navigation */}
        {isAdmin && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Administrative Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <NavigationCard
                title="Dropdown Items"
                description="Edit and manage dropdown menu items"
                icon={Settings}
                href="/admin/dropdown-items"
              />
              <NavigationCard
                title="User Permissions"
                description="Manage user roles and permissions"
                icon={ShieldCheck}
                href="/admin/permissions"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LandingPage;
