"use client";

import { useState } from "react";
import api from "@/lib/axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, User, Calendar, MapPin, Building } from "lucide-react";
import { format } from "date-fns";
import { EmployeeWithRelations } from "@/lib/types";
import { Employee } from "@/generated/prisma_client";

interface DuplicateResponse {
  error: string;
  code: string;
  matches: EmployeeWithRelations[];
  suggestions: {
    rehire: boolean;
    duplicate: boolean;
  };
}

interface DuplicateEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateData: DuplicateResponse;
  employeeFormData: Employee;
  onSuccess: () => void;
}

export function DuplicateEmployeeDialog({
  open,
  onOpenChange,
  duplicateData,
  employeeFormData,
  onSuccess,
}: DuplicateEmployeeDialogProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleRehire = async () => {
    if (!selectedEmployeeId) return;

    setIsLoading(true);
    try {
      // Update the existing employee with new data and reactivate
      const updateData = {
        ...employeeFormData,
        isActive: true, // Ensure the employee is reactivated
      };

      await api.put(`/api/employees/${selectedEmployeeId}`, updateData);

      // Close dialog and notify success
      handleClose();
      onSuccess();
    } catch (err) {
      console.error("Error reactivating employee:", err);
      alert("Failed to reactivate employee. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAnyway = async () => {
    setIsLoading(true);
    try {
      // Send the original request with confirmDuplicate flag
      const employeeData = {
        ...employeeFormData,
        confirmDuplicate: true,
      };

      await api.post("/api/employees", employeeData);

      // Close dialog and notify success
      handleClose();
      onSuccess();
    } catch (err) {
      console.error("Error creating employee:", err);
      alert("Failed to create employee. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeClick = (match: EmployeeWithRelations) => {
    // Only allow selection of inactive employees
    if (!match.isActive) {
      setSelectedEmployeeId(match.id);
    }
  };

  const handleClose = () => {
    setSelectedEmployeeId(null);
    onOpenChange(false);
  };

  const { matches, suggestions } = duplicateData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Potential Duplicate Employee Found
          </DialogTitle>
          <DialogDescription>
            We found {matches.length} existing employee
            {matches.length > 1 ? "s" : ""} with the same name. Please choose
            how you&apos;d like to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {matches.map((match) => (
            <div
              key={match.id}
              className={`p-4 border rounded-lg transition-colors ${
                selectedEmployeeId === match.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              } ${suggestions.rehire && !match.isActive ? "ring-2 ring-amber-200" : ""} ${
                match.isActive
                  ? "opacity-60 cursor-not-allowed"
                  : "cursor-pointer"
              }`}
              onClick={() => handleEmployeeClick(match)}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <span className="font-medium">
                      {match.firstName} {match.lastName}
                    </span>
                    <Badge variant={match.isActive ? "default" : "secondary"}>
                      {match.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>

                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <Building className="h-3 w-3" />
                      <span>{match.title}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Building className="h-3 w-3" />
                      {/* <span>{match.department.name}</span> //need to fix */}
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-3 w-3" />
                      {/* <span>{match.location.name}</span> */}
                      {/* need to fix */}
                    </div>

                    {match.startDate && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Started:{" "}
                          {format(new Date(match.startDate), "MMM d, yyyy")}
                          {match.finishDate && (
                            <span className="ml-2">
                              - Ended:{" "}
                              {format(
                                new Date(match.finishDate),
                                "MMM d, yyyy",
                              )}
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {suggestions.rehire && !match.isActive && (
                  <Badge
                    variant="outline"
                    className="text-amber-600 border-amber-600"
                  >
                    Rehire Candidate
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>

          <div className="flex gap-2">
            {suggestions.rehire && (
              <Button
                onClick={handleRehire}
                disabled={!selectedEmployeeId || isLoading}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isLoading ? "Processing..." : "Reactivate Selected Employee"}
              </Button>
            )}

            <Button
              onClick={handleCreateAnyway}
              disabled={isLoading}
              variant="destructive"
            >
              {isLoading ? "Creating..." : "Create Anyway (Different Person)"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
