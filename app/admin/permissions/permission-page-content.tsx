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
import { SuggestionPanel } from "./suggestion-panel";

const VALID_TABS = ["roles", "mapping", "suggestions"] as const;
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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roles">User Roles</TabsTrigger>
          <TabsTrigger value="mapping">User-Employee Mapping</TabsTrigger>
          <TabsTrigger value="suggestions">Suggested Links</TabsTrigger>
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

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle>Suggested Links</CardTitle>
              <CardDescription>
                The system automatically compares unlinked user accounts against
                employee records to find likely matches. Only users who have not
                yet been linked to an employee will appear here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1 mb-6 border-l-2 pl-3">
                <p>
                  Matches are scored using up to three strategies: comparing the
                  email address format, checking whether the display name
                  matches an employee&apos;s full name exactly, and fuzzy
                  matching for names that are close but not identical. The
                  top three candidates are shown per user, ranked by confidence.
                </p>
                <p>
                  Click <strong className="text-foreground">Link</strong> to
                  confirm a pairing. The user will immediately be associated
                  with that employee record. If none of the suggestions look
                  right, use the{" "}
                  <strong className="text-foreground">
                    User-Employee Mapping
                  </strong>{" "}
                  tab to link them manually.
                </p>
                <p>
                  The matching strategies and confidence threshold can be tuned
                  in{" "}
                  <strong className="text-foreground">App Settings</strong> if
                  the suggestions are missing expected matches or returning too
                  many false positives.
                </p>
                <p>
                  The list is not updated automatically — use the{" "}
                  <strong className="text-foreground">Refresh</strong> button
                  after linking users or changing settings to fetch the latest
                  suggestions.
                </p>
              </div>
              <SuggestionPanel />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
