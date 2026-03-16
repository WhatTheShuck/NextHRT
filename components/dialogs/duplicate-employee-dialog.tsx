"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  User,
  Calendar,
  MapPin,
  Building,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { EmployeeFormData, EmployeeWithRelations } from "@/lib/types";

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
  employeeFormData: EmployeeFormData;
  onSuccess: () => void;
}

interface DuplicateFormProps {
  duplicateData: DuplicateResponse;
  employeeFormData: EmployeeFormData;
  onSuccess: () => void;
  onClose: () => void;
  className?: string;
}

function DuplicateForm({
  duplicateData,
  employeeFormData,
  onSuccess,
  onClose,
  className,
}: DuplicateFormProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);

  const { matches, suggestions } = duplicateData;

  const handleRehire = async () => {
    if (!selectedEmployeeId) return;

    setIsLoading(true);
    try {
      const updateData = {
        ...employeeFormData,
        isActive: true,
      };

      await api.put(`/api/employees/${selectedEmployeeId}`, updateData);

      onClose();
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
      const employeeData = {
        ...employeeFormData,
        confirmDuplicate: true,
      };

      await api.post("/api/employees", employeeData);

      onClose();
      onSuccess();
    } catch (err) {
      console.error("Error creating employee:", err);
      alert("Failed to create employee. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmployeeClick = (match: EmployeeWithRelations) => {
    if (!match.isActive) {
      setSelectedEmployeeId(match.id);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">
        Existing Employees:
      </h3>

      {matches.map((match) => {
        const isSelected = selectedEmployeeId === match.id;
        const isSelectable = !match.isActive;
        const isRecommended = suggestions.rehire && !match.isActive;

        return (
          <div
            key={match.id}
            className={`
              relative p-5 border-2 rounded-xl transition-all duration-200
              ${
                isSelected
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : isSelectable
                    ? "border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white"
                    : "border-gray-100 bg-gray-50"
              }
              ${isRecommended ? "ring-2 ring-amber-200" : ""}
              ${isSelectable ? "cursor-pointer" : "cursor-default"}
            `}
            onClick={() => handleEmployeeClick(match)}
          >
            {isSelected && (
              <div className="absolute top-3 right-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
              </div>
            )}

            {isRecommended && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100">
                  Recommended for Rehire
                </Badge>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <User className="h-4 w-4 text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-lg">
                      {match.firstName} {match.lastName}
                    </h4>
                    <p className="text-sm text-gray-600">{match.title}</p>
                  </div>
                </div>

                <Badge
                  variant={match.isActive ? "default" : "secondary"}
                  className={`
                    ${
                      match.isActive
                        ? "bg-green-100 text-green-800 border-green-300"
                        : "bg-gray-100 text-gray-700 border-gray-300"
                    }
                  `}
                >
                  {match.isActive ? "Currently Active" : "Inactive"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <Building className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium">Department:</span>
                  <span className="text-gray-600">
                    {match.department?.name || "Not specified"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium">Location:</span>
                  <span className="text-gray-600">
                    {match.location?.name || "Not specified"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-gray-700">
                  <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span className="font-medium">Title:</span>
                  <span className="text-gray-600">{match.title}</span>
                </div>

                {match.startDate && (
                  <div className="flex items-center gap-2 text-gray-700 md:col-span-2">
                    <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="font-medium">Employment:</span>
                    <span className="text-gray-600">
                      Started {format(new Date(match.startDate), "MMM d, yyyy")}
                      {match.finishDate && (
                        <span className="ml-2">
                          • Ended{" "}
                          {format(new Date(match.finishDate), "MMM d, yyyy")}
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {isSelectable && !isSelected && (
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded-md border border-dashed border-gray-200">
                  Click to select this employee for reactivation
                </div>
              )}

              {match.isActive && (
                <div className="text-xs text-gray-600 bg-gray-100 p-2 rounded-md">
                  This employee is currently active and cannot be selected for
                  reactivation
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="pt-4 border-t">
        <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
          {suggestions.rehire && (
            <Button
              onClick={handleRehire}
              disabled={!selectedEmployeeId || isLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
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
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DuplicateEmployeeDialog({
  open,
  onOpenChange,
  duplicateData,
  employeeFormData,
  onSuccess,
}: DuplicateEmployeeDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const { matches } = duplicateData;

  const handleClose = () => onOpenChange(false);

  const title = "Potential Duplicate Employee Found";
  const description = `We found ${matches.length} existing employee${matches.length > 1 ? "s" : ""} with the same name. Please choose how you'd like to proceed below.`;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              {title}
            </DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DuplicateForm
              duplicateData={duplicateData}
              employeeFormData={employeeFormData}
              onSuccess={onSuccess}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left space-y-2">
          <DrawerTitle className="flex items-center gap-3 text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            {title}
          </DrawerTitle>
          <DrawerDescription className="text-base leading-relaxed">
            {description}
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-4 overflow-y-auto">
          <DuplicateForm
            duplicateData={duplicateData}
            employeeFormData={employeeFormData}
            onSuccess={onSuccess}
            onClose={handleClose}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
