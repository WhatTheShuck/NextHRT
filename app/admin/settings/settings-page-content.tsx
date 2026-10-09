"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchingSettings } from "./matching-settings";
import { OnboardingSettings } from "./onboarding-settings";
import { TrainingDeliverSettings } from "./training-deliver-settings";
import { SettingsHistory } from "./settings-history";
import { ThemeSettings } from "./theme-settings";

const TABS = ["matching", "onboarding", "training", "history", "themes"];

export function SettingsPageContent() {
  // ?tab= lets other pages deep-link to a tab (e.g. the Email section → Onboarding).
  const requested = useSearchParams().get("tab");
  const defaultTab = requested && TABS.includes(requested) ? requested : "matching";

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">App Settings</h1>

      {/*
        Tabs with a Save button stay mounted while hidden, so edits survive
        switching tabs. Change History mounts fresh each time to show new saves.
      */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="matching" data-tour="settings-tab-matching">Matching</TabsTrigger>
          <TabsTrigger value="onboarding" data-tour="settings-tab-onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="training" data-tour="settings-tab-training">Training</TabsTrigger>
          <TabsTrigger value="history" data-tour="settings-tab-history">Change History</TabsTrigger>
          <TabsTrigger value="themes" data-tour="settings-tab-themes">Themes</TabsTrigger>
        </TabsList>

        <TabsContent value="matching" forceMount className="mt-6 data-[state=inactive]:hidden">
          <MatchingSettings />
        </TabsContent>

        <TabsContent value="onboarding" forceMount className="mt-6 data-[state=inactive]:hidden">
          <OnboardingSettings />
        </TabsContent>

        <TabsContent value="training" forceMount className="mt-6 data-[state=inactive]:hidden">
          <TrainingDeliverSettings />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <SettingsHistory />
        </TabsContent>

        <TabsContent value="themes" forceMount className="mt-6 data-[state=inactive]:hidden">
          <ThemeSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
