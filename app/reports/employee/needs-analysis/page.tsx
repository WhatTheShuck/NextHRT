"use client";
import { DataTable } from "@/components/table-component";
import { columns } from "./columns";
import { ExportButtons } from "@/components/ExportButtons";
import React, { useEffect, useState, useMemo } from "react";
import { Archive, BadgeCheck } from "lucide-react";
import { EmployeeWithRelations } from "@/lib/types";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { EmployeeCombobox } from "@/components/combobox/employee-combobox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// Unified requirement item interface for display
export interface RequirementItem extends Record<string, unknown> {
  id: string; // Format: "training-{id}" or "ticket-{id}"
  type: "training" | "ticket";
  name: string;
  category?: string; // For training
  ticketCode?: string; // For tickets
  isCompleted: boolean;
  isExempted: boolean;
  departmentName: string; // Department causing requirement
  locationName: string; // Location causing requirement
}

export default function Page() {
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeWithRelations[]>([]);
  const [requirementsData, setRequirementsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [includeInactiveEmployees, setIncludeInactiveEmployees] =
    useState(false);
  const [includeCompletedRecords, setIncludeCompletedRecords] = useState(false);
  const [sortedData, setSortedData] = useState<RequirementItem[]>([]);
  const [isSorted, setIsSorted] = useState(false);

  // Compute filtered employees based on toggle
  const filteredEmployees = useMemo(() => {
    return includeInactiveEmployees
      ? allEmployees
      : allEmployees.filter((emp) => emp.isActive);
  }, [allEmployees, includeInactiveEmployees]);

  // Compute unified requirements list with filtering
  const filteredRequirements = useMemo(() => {
    if (!requirementsData) return [];

    const {
      allTrainingRequirements = [],
      allTicketRequirements = [],
      exemptions = [],
      trainingRequired = [],
      ticketRequired = [],
    } = requirementsData;

    // Create exemption lookup maps for quick filtering
    const trainingExemptions = new Map(
      exemptions
        .filter((ex: any) => ex.type === "Training" && ex.trainingId)
        .map((ex: any) => [ex.trainingId, ex]),
    );

    const ticketExemptions = new Map(
      exemptions
        .filter((ex: any) => ex.type === "Ticket" && ex.ticketId)
        .map((ex: any) => [ex.ticketId, ex]),
    );

    const items: RequirementItem[] = [];

    // Process training requirements
    const trainingToProcess = includeCompletedRecords
      ? allTrainingRequirements
      : trainingRequired;

    trainingToProcess.forEach((req: any) => {
      const exemption = trainingExemptions.get(req.trainingId);

      // If exempted and we're not showing completed records, skip
      if (exemption && !includeCompletedRecords) return;

      // Check if completed: if it's NOT in trainingRequired, it means it's completed
      const isCompleted = !trainingRequired.some(
        (tr: any) => tr.trainingId === req.trainingId,
      );
      const isExempted = !!exemption;

      items.push({
        id: `training-${req.trainingId}`,
        type: "training",
        name: req.training?.title || "Unknown Training",
        category: req.training?.category || "",
        ticketCode: "", // Empty for training
        isCompleted,
        isExempted,
        departmentName:
          req.departmentId === -1
            ? "All Departments"
            : req.department?.name || "Unknown Department",
        locationName:
          req.locationId === -1
            ? "All Locations"
            : req.location?.name || "Unknown Location",
      });
    });

    // Process ticket requirements
    const ticketsToProcess = includeCompletedRecords
      ? allTicketRequirements
      : ticketRequired;

    ticketsToProcess.forEach((req: any) => {
      const exemption = ticketExemptions.get(req.ticketId);

      // If exempted and we're not showing completed records, skip
      if (exemption && !includeCompletedRecords) return;

      // Check if completed: if it's NOT in ticketRequired, it means it's completed
      const isCompleted = !ticketRequired.some(
        (tr: any) => tr.ticketId === req.ticketId,
      );
      const isExempted = !!exemption;

      items.push({
        id: `ticket-${req.ticketId}`,
        type: "ticket",
        name: req.ticket?.ticketName || "Unknown Ticket",
        category: "", // Empty for tickets
        ticketCode: req.ticket?.ticketCode || "",
        isCompleted,
        isExempted,
        departmentName:
          req.departmentId === -1
            ? "All Departments"
            : req.department?.name || "Unknown Department",
        locationName:
          req.locationId === -1
            ? "All Locations"
            : req.location?.name || "Unknown Location",
      });
    });

    return items;
  }, [requirementsData, includeCompletedRecords]);

  // Handle employee selection
  const handleEmployeeSelect = (employeeId: string) => {
    const selectedEmployee = filteredEmployees.find(
      (employee) => employee.id.toString() === employeeId,
    );
    if (selectedEmployee) {
      setSelectedEmployeeId(selectedEmployee.id);
      fetchRequirements(selectedEmployee.id);
    }
  };

  // Handle inactive employees toggle
  const handleInactiveEmployeesToggle = (checked: boolean) => {
    setIncludeInactiveEmployees(checked);
    // Reset selection if current employee becomes filtered out
    if (!checked && selectedEmployeeId) {
      const selectedEmployee = allEmployees.find(
        (emp) => emp.id === selectedEmployeeId,
      );
      if (selectedEmployee && !selectedEmployee.isActive) {
        setSelectedEmployeeId(null);
        setRequirementsData(null);
      }
    }
  };

  const handleCompletedRecordsToggle = (checked: boolean) => {
    setIncludeCompletedRecords(checked);
  };

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response =
          await api.get<EmployeeWithRelations[]>("/api/employees");
        const data = response.data;
        setAllEmployees(data);
        setEmployees(data.filter((emp) => emp.isActive));
      } catch (err) {
        setError(err instanceof AxiosError ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const fetchRequirements = async (employeeId: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(
        `/api/requirements?employeeId=${employeeId}`,
      );
      setRequirementsData(response.data);
    } catch (err) {
      setError(err instanceof AxiosError ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-6">
          Individual Employee Needs Analysis
        </h1>

        {/* Configuration toggles */}
        <div className="p-4 rounded-lg mb-6">
          <div className="flex items-center gap-8">
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
                <Archive className="h-4 w-4" />
                Include inactive employees
              </Label>
            </div>
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
          <EmployeeCombobox
            employees={filteredEmployees}
            selectedEmployeeId={selectedEmployeeId?.toString() || null}
            onSelect={handleEmployeeSelect}
          />
        </div>

        {loading && <div className="text-center py-4">Loading...</div>}

        {error && (
          <div className="text-center py-4 text-red-500">Error: {error}</div>
        )}

        {selectedEmployeeId && !loading && !error && (
          <div className="container py-4 mx-auto">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground">
                Showing {filteredRequirements.length} requirement(s)
              </div>
              <ExportButtons
                data={filteredRequirements}
                columns={columns}
                filename="employee-requirements"
                title="Employee Requirements Report"
                sortedData={sortedData}
                isSorted={isSorted}
              />
            </div>
            <DataTable
              columns={columns}
              data={filteredRequirements}
              onSortedDataChange={(data, sorted) => {
                setSortedData(data);
                setIsSorted(sorted);
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
