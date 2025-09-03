"use client";

import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Archive, Check, Users, Clock } from "lucide-react";
import { Ticket } from "@/generated/prisma_client";
import { TicketRecordsWithRelations, TicketWithRelations } from "@/lib/types";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import api from "@/lib/axios";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TicketCombobox } from "@/components/combobox/ticket-combobox";

export function ExpiringTicketRecordsPage() {
  const [ticketSelection, setTicketSelection] = useState<Ticket[]>([]);
  const [filteredTicketRecords, setFilteredTicketRecords] = useState<
    TicketRecordsWithRelations[]
  >([]);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedTicketTitle, setSelectedTicketTitle] = useState<string | null>(
    null,
  );
  const [ticketRecords, setTicketRecords] = useState<
    TicketRecordsWithRelations[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [locations, setLocations] = useState<string[]>([]);

  const [includeInactiveEmployees, setIncludeInactiveEmployees] =
    useState(false);
  const [includeLegacyTicket, setIncludeLegacyTicket] = useState(false);
  const [fetchingTickets, setFetchingTickets] = useState(false);

  const expirationDates = ["30", "60", "90", "180", "360"];
  const [selectedExpirationDays, setSelectedExpirationDays] =
    useState<string>("30");

  // Fetch tickets based on legacy toggle
  const fetchTickets = async (includeLegacy: boolean = false) => {
    setFetchingTickets(true);
    try {
      const response = await api.get(
        `/api/tickets?activeOnly=${!includeLegacy}`,
      );
      setTicketSelection(response.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch tickets");
    } finally {
      setFetchingTickets(false);
    }
  };

  const fetchRecords = async (
    ticketID: number,
    expirationDays: string = "30",
    includeInactive: boolean = false,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("expirationDays", expirationDays);
      params.append("activeOnly", (!includeInactive).toString());

      const response = await api.get<TicketWithRelations>(
        `/api/tickets/${ticketID}?${params.toString()}`,
      );
      const data = response.data;
      const records = data.ticketRecords || [];
      setTicketRecords(records);
      setSelectedTicketId(Number(ticketID));
      setFilteredTicketRecords(records);

      // Extract unique locations
      const uniqueLocations = Array.from(
        new Set(
          records.map(
            (rec: TicketRecordsWithRelations) =>
              rec.ticketHolder?.location.name,
          ),
        ),
      ).filter(Boolean) as string[]; // Filter out null/undefined values

      setLocations(uniqueLocations);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Handle ticket selection
  const handleTicketSelect = (ticketId: string) => {
    const selectedTicket = ticketSelection.find(
      (ticket) => ticket.id.toString() === ticketId,
    );
    if (selectedTicket) {
      setSelectedTicketTitle(selectedTicket.ticketName);
      fetchRecords(
        Number(ticketId),
        selectedExpirationDays,
        includeInactiveEmployees,
      );
    }
  };

  // Handle legacy ticket toggle
  const handleLegacyToggle = (checked: boolean) => {
    setIncludeLegacyTicket(checked);
    fetchTickets(checked);
    // Reset selection when switching ticket types
    setSelectedTicketId(null);
    setSelectedTicketTitle(null);
    setTicketRecords([]);
    setFilteredTicketRecords([]);
  };

  // Handle inactive employees toggle
  const handleInactiveEmployeesToggle = (checked: boolean) => {
    setIncludeInactiveEmployees(checked);
    // Re-fetch records if a ticket is selected
    if (selectedTicketId) {
      fetchRecords(selectedTicketId, selectedExpirationDays, checked);
    }
  };

  // Handle expiration days change
  const handleExpirationDaysChange = (value: string) => {
    setSelectedExpirationDays(value);
    if (selectedTicketId) {
      setSelectedLocation(null);
      fetchRecords(selectedTicketId, value, includeInactiveEmployees);
    }
  };

  // Filter records by location
  const filterByLocation = (location: string | null) => {
    setSelectedLocation(location);

    if (location === null) {
      setFilteredTicketRecords(ticketRecords);
    } else {
      setFilteredTicketRecords(
        ticketRecords.filter(
          (rec) => rec.ticketHolder?.location.name === location,
        ),
      );
    }
  };

  // Initial effect to fetch tickets after component mounts (session ready)
  useEffect(() => {
    fetchTickets();
  }, []);

  return (
    <>
      {/* Configuration toggles */}
      <div className="p-4 rounded-lg mb-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center space-x-2">
            <Switch
              id="legacy-ticket"
              checked={includeLegacyTicket}
              onCheckedChange={handleLegacyToggle}
            />
            <Label htmlFor="legacy-ticket" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Include legacy tickets
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="inactive-employees"
              checked={includeInactiveEmployees}
              onCheckedChange={handleInactiveEmployeesToggle}
            />
            <Label
              htmlFor="inactive-employees"
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Include inactive employees
            </Label>
          </div>
        </div>
      </div>

      {/* Ticket selection and expiration filter */}
      <div className="flex items-center gap-4 mb-6">
        <TicketCombobox
          tickets={ticketSelection}
          onSelect={handleTicketSelect}
          selectedTicketId={selectedTicketId}
          disabled={fetchingTickets}
          placeholder={
            fetchingTickets
              ? "Loading tickets..."
              : "Search and select a ticket course..."
          }
        />

        {selectedTicketId && !loading && !error && (
          <Select
            value={selectedExpirationDays}
            onValueChange={handleExpirationDaysChange}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {expirationDates.map((date) => (
                <SelectItem key={date} value={date}>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Expiring in {date} days
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4">Loading Ticket Records...</div>
      ) : null}
      {error ? (
        <div className="text-center py-4 text-red-500">Error: {error}</div>
      ) : null}

      {selectedTicketId && !loading && !error && (
        <div className="container py-10 mx-auto">
          <div className="flex justify-between items-center mb-4">
            <ExportButtons
              data={filteredTicketRecords}
              columns={columns}
              filename={`${selectedTicketTitle}-expiring-${selectedExpirationDays}days`}
              title={`${selectedTicketTitle} - Expiring Records (${selectedExpirationDays} days)`}
            />
            <p className="font-medium">
              Record Count: {filteredTicketRecords.length}
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  {selectedLocation
                    ? `Location: ${selectedLocation}`
                    : "Filter Location"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56">
                <div className="grid gap-2">
                  <div className="font-medium">Filter by location</div>
                  <ul className="max-h-60 overflow-auto">
                    {/* Show All option */}
                    <li
                      className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-slate-100 rounded"
                      onClick={() => filterByLocation(null)}
                    >
                      <span>All Locations</span>
                      {selectedLocation === null && (
                        <Check className="h-4 w-4" />
                      )}
                    </li>

                    {/* Location items */}
                    {locations.map((location) => (
                      <li
                        key={location}
                        className="flex items-center justify-between py-1 px-2 cursor-pointer hover:bg-slate-100 rounded"
                        onClick={() => filterByLocation(location)}
                      >
                        <span>{location}</span>
                        {selectedLocation === location && (
                          <Check className="h-4 w-4" />
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <DataTable columns={columns} data={filteredTicketRecords} />
        </div>
      )}
    </>
  );
}
