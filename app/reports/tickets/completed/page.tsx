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
import { Check } from "lucide-react";
import { Ticket } from "@/generated/prisma_client";
import { TicketRecordsWithRelations, TicketWithRelations } from "@/lib/types";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import api from "@/lib/axios";

export default function CompletedTicketPage() {
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

  const fetchRecords = async (ticketID: number) => {
    setLoading(true);
    try {
      const response = await api.get<TicketWithRelations>(
        `/api/tickets/${ticketID}`,
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const fetchTickets = async () => {
      const response = await fetch("/api/tickets");
      const data = await response.json();
      setTicketSelection(data);
    };
    fetchTickets();
  }, []);

  // Filter records by location
  const filterByLocation = (location: string | null) => {
    setSelectedLocation(location);

    if (location === null) {
      // Reset filter
      setFilteredTicketRecords(ticketRecords);
    } else {
      // Apply filter
      setFilteredTicketRecords(
        ticketRecords.filter(
          (rec) => rec.ticketHolder?.location.name === location,
        ),
      );
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Ticket Completion Records</h1>

      <div className="flex items-center gap-4 mb-1">
        <Select
          onValueChange={(value) => {
            const selectedTicket = ticketSelection.find(
              (ticket) => ticket.id.toString() === value,
            );
            if (selectedTicket) {
              setSelectedTicketTitle(selectedTicket.ticketName);
            }
            fetchRecords(Number(value));
          }}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Select a ticket type" />
          </SelectTrigger>
          <SelectContent>
            {ticketSelection.map((ticket) => (
              <SelectItem key={ticket.id} value={ticket.id.toString()}>
                {ticket.ticketName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
              filename={`${selectedTicketTitle}-completions`}
              title={`${selectedTicketTitle} - Completion Records`}
            />
            <p className="font-medium">
              {" "}
              Record Count: {filteredTicketRecords.length}{" "}
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
    </div>
  );
}
