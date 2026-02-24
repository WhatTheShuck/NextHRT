"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  User,
  FileText,
  Clock,
  GraduationCap,
  BookOpen,
  IdCard,
  ShieldOff,
  Link,
} from "lucide-react";
import { useEmployee } from "./employee-context";
import { useSession } from "@/lib/auth-client";
import { OverviewTab } from "./tabs/overview-tab";
import { InternalTrainingTab } from "./tabs/training-internal-tab";
import { ExternalTrainingTab } from "./tabs/training-external-tab";
import { SOPTrainingTab } from "./tabs/training-sop-tab";
import { TicketTab } from "./tabs/tickets-tab";
import { HistoryTab } from "./tabs/history-tab";
import { ExemptionTab } from "./tabs/exemptions-tab";
import { UserLinkTab } from "./tabs/user-link-tab";

const VALID_TABS = [
  "overview",
  "internal-training",
  "external-training",
  "sop-training",
  "tickets",
  "history",
  "external",
  "user-link",
] as const;
type TabValue = (typeof VALID_TABS)[number];

export function EmployeeTabs() {
  const { employee } = useEmployee();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "Admin";
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get the tab from URL or default to overview
  const [activeTab, setActiveTab] = useState<TabValue>(
    (searchParams.get("tab") as TabValue) || "overview",
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

  if (!employee) return null;

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="space-y-6"
    >
      <TabsList className="h-auto grid grid-cols-2 gap-1 sm:flex sm:flex-row w-full sm:w-auto items-stretch sm:items-center justify-between">
        <TabsTrigger
          value="overview"
          className="w-full sm:w-auto justify-start"
        >
          <User className="h-4 w-4 mr-2" />
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="external-training"
          className="w-full sm:w-auto justify-start"
        >
          <GraduationCap className="h-4 w-4 mr-2" />
          External Training
        </TabsTrigger>
        <TabsTrigger
          value="internal-training"
          className="w-full sm:w-auto justify-start"
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Internal Training
        </TabsTrigger>
        <TabsTrigger
          value="sop-training"
          className="w-full sm:w-auto justify-start"
        >
          <FileText className="h-4 w-4 mr-2" />
          SOPs
        </TabsTrigger>
        <TabsTrigger value="tickets" className="w-full sm:w-auto justify-start">
          <IdCard className="h-4 w-4 mr-2" />
          Tickets
        </TabsTrigger>
        <TabsTrigger
          value="exemptions"
          className="w-full sm:w-auto justify-start"
        >
          <ShieldOff className="h-4 w-4 mr-2" />
          Exemptions
        </TabsTrigger>
        <TabsTrigger value="history" className="w-full sm:w-auto justify-start">
          <Clock className="h-4 w-4 mr-2" />
          History
        </TabsTrigger>
        {isAdmin && (
          <TabsTrigger
            value="user-link"
            className="w-full sm:w-auto justify-start"
          >
            <Link className="h-4 w-4 mr-2" />
            User Link
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab />
      </TabsContent>

      <TabsContent value="external-training">
        <ExternalTrainingTab />
      </TabsContent>
      <TabsContent value="internal-training">
        <InternalTrainingTab />
      </TabsContent>
      <TabsContent value="sop-training">
        <SOPTrainingTab />
      </TabsContent>
      <TabsContent value="tickets">
        <TicketTab />
      </TabsContent>
      <TabsContent value="exemptions">
        <ExemptionTab />
      </TabsContent>
      <TabsContent value="history">
        <HistoryTab />
      </TabsContent>
      <TabsContent value="user-link">
        <UserLinkTab />
      </TabsContent>
    </Tabs>
  );
}
