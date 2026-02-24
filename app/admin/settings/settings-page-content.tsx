"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchingSettings } from "./matching-settings";

export function SettingsPageContent() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">App Settings</h1>

      <Tabs defaultValue="matching" className="w-full">
        <TabsList className="grid w-full grid-cols-1 max-w-xs">
          <TabsTrigger value="matching">Matching</TabsTrigger>
        </TabsList>

        <TabsContent value="matching" className="mt-6">
          <MatchingSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
