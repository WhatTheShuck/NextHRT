"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, Award, FileText, Clock } from "lucide-react";
import { useEmployee } from "./employee-context";
import { OverviewTab } from "./tabs/overview-tab";
import { TrainingTab } from "./tabs/training-tab";
import { TicketTab } from "./tabs/tickets-tab";
import { HistoryTab } from "./tabs/history-tab";

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
        <TabsTrigger value="training">
          <Award className="h-4 w-4 mr-2" />
          Training
        </TabsTrigger>
        <TabsTrigger value="tickets">
          <FileText className="h-4 w-4 mr-2" />
          Tickets
        </TabsTrigger>
        <TabsTrigger value="history">
          <Clock className="h-4 w-4 mr-2" />
          History
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab />
      </TabsContent>

      <TabsContent value="training">
        <TrainingTab />
      </TabsContent>

      <TabsContent value="tickets">
        <TicketTab />
      </TabsContent>

      <TabsContent value="history">
        <HistoryTab />
      </TabsContent>
    </Tabs>
  );
}
