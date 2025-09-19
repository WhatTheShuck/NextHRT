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
} from "lucide-react";
import { useEmployee } from "./employee-context";
import { OverviewTab } from "./tabs/overview-tab";
import { InternalTrainingTab } from "./tabs/training-internal-tab";
import { ExternalTrainingTab } from "./tabs/training-external-tab";
import { SOPTrainingTab } from "./tabs/training-sop-tab";
import { TicketTab } from "./tabs/tickets-tab";
import { HistoryTab } from "./tabs/history-tab";
import { ExemptionTab } from "./tabs/exemptions-tab";

const VALID_TABS = ["overview", "training", "tickets", "history"] as const;
type TabValue = (typeof VALID_TABS)[number];

export function EmployeeTabs() {
  const { employee } = useEmployee();
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
      <TabsList>
        <TabsTrigger value="overview">
          <User className="h-4 w-4 mr-2" />
          Overview
        </TabsTrigger>
        <TabsTrigger value="external-training">
          <GraduationCap className="h-4 w-4 mr-2" />
          External Training
        </TabsTrigger>
        <TabsTrigger value="internal-training">
          <BookOpen className="h-4 w-4 mr-2" />
          Internal Training
        </TabsTrigger>
        <TabsTrigger value="sop-training">
          <FileText className="h-4 w-4 mr-2" />
          SOPs
        </TabsTrigger>
        <TabsTrigger value="tickets">
          <IdCard className="h-4 w-4 mr-2" />
          Tickets
        </TabsTrigger>
        <TabsTrigger value="exemptions">
          <ShieldOff className="h-4 w-4 mr-2" />
          Exemptions
        </TabsTrigger>
        <TabsTrigger value="history">
          <Clock className="h-4 w-4 mr-2" />
          History
        </TabsTrigger>
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
    </Tabs>
  );
}
