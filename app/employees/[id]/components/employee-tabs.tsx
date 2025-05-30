// app/employees/[id]/components/employee-tabs.tsx
"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { User, Award, FileText, Clock } from "lucide-react";
import { useEmployee } from "./employee-context";
import { OverviewTab } from "./tabs/overview-tab";
import { TrainingTab } from "./tabs/training-tab";
import { TicketTab } from "./tabs/tickets-tab";
import { HistoryTab } from "./tabs/history-tab";

export function EmployeeTabs() {
  const { employee } = useEmployee();

  if (!employee) return null;

  return (
    <Tabs defaultValue="overview" className="space-y-6">
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
        {" "}
        <OverviewTab />{" "}
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
