"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchingSettings } from "./matching-settings";
import { SettingsHistory } from "./settings-history";

export function SettingsPageContent() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">App Settings</h1>

      <Tabs defaultValue="matching" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="matching">Matching</TabsTrigger>
          <TabsTrigger value="history">Change History</TabsTrigger>
        </TabsList>

        <TabsContent value="matching" className="mt-6">
          <MatchingSettings />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <SettingsHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
