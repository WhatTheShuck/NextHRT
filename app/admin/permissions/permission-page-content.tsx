"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserRoleManagement } from "./user-role-management";
import { UserEmployeeMapping } from "./user-employee-mapping";

const VALID_TABS = ["roles", "mapping"] as const;
type TabValue = (typeof VALID_TABS)[number];

export function PermissionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get the tab from URL or default to roles
  const [activeTab, setActiveTab] = useState<TabValue>(
    (searchParams.get("tab") as TabValue) || "roles",
  );

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const tabValue = value as TabValue;
    setActiveTab(tabValue);

    // Create new URLSearchParams to preserve other params
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabValue);

    // Update URL without causing a page reload
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // Sync state with URL on page load/refresh
  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabValue;
    if (tabParam && VALID_TABS.includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="roles">User Roles</TabsTrigger>
          <TabsTrigger value="mapping">User-Employee Mapping</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Manage User Roles</CardTitle>
              <CardDescription>
                Assign roles to users to control their access permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserRoleManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping">
          <Card>
            <CardHeader>
              <CardTitle>User-Employee Mapping</CardTitle>
              <CardDescription>
                Link user accounts to employee records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserEmployeeMapping />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
