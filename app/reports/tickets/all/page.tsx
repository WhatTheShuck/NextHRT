"use client";

import React, { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Archive, Check } from "lucide-react";
import { TicketRecordsWithRelations } from "@/lib/types";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import api from "@/lib/axios";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function CompletedTicketPage() {
  const [filteredTicketRecords, setFilteredTicketRecords] = useState<
    TicketRecordsWithRelations[]
  >([]);
  const [selectedTicketTitle, setSelectedTicketTitle] = useState<string | null>(
    null,
  );
  const [ticketRecords, setTicketRecords] = useState<
    TicketRecordsWithRelations[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeLegacyTicket, setIncludeLegacyTicket] = useState(false);
  const [includeExpiredTickets, setIncludeExpiredTickets] = useState(false);

  // Fetch tickets based on legacy and expired toggles
  const fetchTickets = async (
    includeLegacy: boolean = false,
    includeExpired: boolean = false,
  ) => {
    setLoading(true);
    try {
      const response = await api.get(
        `/api/ticket-records?activeOnly=${!includeLegacy}&includeExpired=${includeExpired}`,
      );
      setTicketRecords(response.data);
      setFilteredTicketRecords(response.data);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  };

  // Handle legacy ticket toggle
  const handleLegacyToggle = (checked: boolean) => {
    setIncludeLegacyTicket(checked);
    fetchTickets(checked, includeExpiredTickets);
    // Reset selection when switching ticket types
    setSelectedTicketTitle(null);
  };

  // Handle expired ticket toggle
  const handleExpiredToggle = (checked: boolean) => {
    setIncludeExpiredTickets(checked);
    fetchTickets(includeLegacyTicket, checked);
    // Reset selection when switching ticket types
    setSelectedTicketTitle(null);
  };

  // Initial effect to fetch tickets after component mounts
  useEffect(() => {
    fetchTickets(includeLegacyTicket, includeExpiredTickets);
  }, []);

  return (
    <>
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">All Completed Tickets</h1>

        {/* Configuration toggles */}
        <div className="p-4 rounded-lg mb-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center space-x-2">
              <Switch
                id="legacy-ticket"
                checked={includeLegacyTicket}
                onCheckedChange={handleLegacyToggle}
              />
              <Label
                htmlFor="legacy-ticket"
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Include legacy tickets
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="expired-ticket"
                checked={includeExpiredTickets}
                onCheckedChange={handleExpiredToggle}
              />
              <Label
                htmlFor="expired-ticket"
                className="flex items-center gap-2"
              >
                <Archive className="h-4 w-4" />
                Include expired tickets
              </Label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-4">Loading Ticket Records...</div>
        ) : null}
        {error ? (
          <div className="text-center py-4 text-red-500">Error: {error}</div>
        ) : null}

        {!loading && !error && (
          <div className="container py-10 mx-auto">
            <div className="flex justify-between items-center mb-4">
              <p className="font-medium">
                Record Count: {filteredTicketRecords.length}
              </p>
              <ExportButtons
                data={filteredTicketRecords}
                columns={columns}
                filename={`${selectedTicketTitle || "all-tickets"}-completions`}
                title={`${selectedTicketTitle || "All Tickets"} - Completion Records`}
              />
            </div>
            <DataTable columns={columns} data={filteredTicketRecords} />
          </div>
        )}
      </div>
    </>
  );
}
