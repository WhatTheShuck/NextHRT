"use client";

import { ScheduledJobsCard } from "./scheduled-jobs-card";
import { JobHistoryTable } from "./job-history-table";
import { HistoryArchivalCard } from "./history-archival-card";

export function JobsPageContent() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-bold mb-6">Background Jobs</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <ScheduledJobsCard />
          <JobHistoryTable />
        </div>
        <div>
          <HistoryArchivalCard />
        </div>
      </div>
    </div>
  );
}
