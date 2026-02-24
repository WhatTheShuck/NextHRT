"use client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import React, { useEffect, useMemo, useState } from "react";
import { Archive, BadgeCheck } from "lucide-react";
import { EmployeeWithRequirementStatus } from "@/lib/types";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TicketCombobox } from "@/components/combobox/ticket-combobox";
import { Ticket } from "@/generated/prisma_client";

export default function Page() {
  const [allEmployees, setAllEmployees] = useState<
    EmployeeWithRequirementStatus[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeCompletedRecords, setIncludeCompletedRecords] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedTicketName, setSelectedTicketName] = useState<string>("");
  const [sortedData, setSortedData] = useState<EmployeeWithRequirementStatus[]>(
    [],
  );
  const [isSorted, setIsSorted] = useState(false);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const response = await api.get<Ticket[]>("/api/tickets");
        setTickets(response.data);
      } catch (error) {
        console.error("Error fetching tickets:", error);
        setError("Error fetching tickets");
      } finally {
        setLoading(false);
      }
    };
    fetchTicket();
  }, []);

  const fetchEmployees = async (ticketId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/requirements?ticketId=${ticketId}`);

      setAllEmployees(response.data.employees);
    } catch (err) {
      if (err instanceof AxiosError && err.response?.status === 404) {
        setError(
          "No requirements found for this ticket. Please select a different ticket or contact your administrator.",
        );
      } else {
        setError(err instanceof AxiosError ? err.message : "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCompletedRecordsToggle = (checked: boolean) => {
    setIncludeCompletedRecords(checked);
  };

  // Handle ticket selection
  const handleTicketSelect = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    const ticket = tickets.find((t) => t.id.toString() === ticketId);
    setSelectedTicketName(ticket?.ticketName || "");
    fetchEmployees(ticketId);
  };

  // Filter employees based on completed records toggle
  const displayedEmployees = useMemo(() => {
    if (includeCompletedRecords) {
      return allEmployees;
    } else {
      return allEmployees.filter((emp) => emp.requirementStatus === "Required");
    }
  }, [allEmployees, includeCompletedRecords]);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">
        Individual Ticket Needs Analysis Report
      </h1>

      {/* Configuration toggles */}
      <div className="p-4 rounded-lg mb-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center space-x-2">
            <Switch
              id="completed-records"
              checked={includeCompletedRecords}
              onCheckedChange={handleCompletedRecordsToggle}
            />
            <Label
              htmlFor="completed-records"
              className="flex items-center gap-2"
            >
              <BadgeCheck className="h-4 w-4" />
              Include completed records
            </Label>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4 mb-6">
        <TicketCombobox
          tickets={tickets}
          selectedTicketId={selectedTicketId}
          onSelect={handleTicketSelect}
        />
      </div>

      {/* Loading state */}
      {loading && <div className="text-center py-8">Loading...</div>}

      {/* Error state */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      )}

      {/* Data table */}
      {selectedTicketId && !loading && !error && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {displayedEmployees.length} employee(s)
            </div>
            <ExportButtons
              data={displayedEmployees}
              columns={columns}
              filename={`ticket-requirements-${selectedTicketName.toLowerCase().replace(/\s+/g, "-")}`}
              title={`Ticket Requirements Report - ${selectedTicketName}`}
              sortedData={sortedData}
              isSorted={isSorted}
            />
          </div>
          <DataTable
            columns={columns}
            data={displayedEmployees}
            onSortedDataChange={(data, sorted) => {
              setSortedData(data);
              setIsSorted(sorted);
            }}
          />
        </div>
      )}
    </div>
  );
}
