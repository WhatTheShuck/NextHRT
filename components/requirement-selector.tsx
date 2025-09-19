"use client";

import { Department, Location } from "@/generated/prisma_client";
import api from "@/lib/axios";
import React, { useEffect, useState } from "react";
import { DepartmentCombobox } from "./combobox/department-combobox";
import { LocationCombobox } from "./combobox/location-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X, Plus } from "lucide-react";

export interface RequirementPair {
  id: string; // unique identifier for the pair
  departmentId: number;
  locationId: number;
  departmentName: string;
  locationName: string;
}

interface RequirementSelectorProps {
  value?: RequirementPair[];
  onChange?: (requirements: RequirementPair[]) => void;
  disabled?: boolean;
  onUnsavedChanges?: (hasUnsavedChanges: boolean) => void; // New prop
}

export function RequirementSelector({
  value = [],
  onChange,
  disabled = false,
  onUnsavedChanges, // New prop
}: RequirementSelectorProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [requirements, setRequirements] = useState<RequirementPair[]>(value);
  const [currentDepartmentId, setCurrentDepartmentId] = useState<number | null>(
    null,
  );
  const [currentLocationId, setCurrentLocationId] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [departmentsRes, locationsRes] = await Promise.all([
          api.get<Department[]>(
            "/api/departments?includeHidden=true&activeOnly=true",
          ),
          api.get<Location[]>(
            "/api/locations?includeHidden=true&activeOnly=true",
          ),
        ]);

        setDepartments(departmentsRes.data);
        setLocations(locationsRes.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Update local state when value prop changes
  useEffect(() => {
    setRequirements(value);
  }, [value]);

  // Check for unsaved changes and notify parent
  useEffect(() => {
    const hasUnsavedChanges =
      currentDepartmentId !== null &&
      currentLocationId !== null &&
      canAddRequirement();
    onUnsavedChanges?.(hasUnsavedChanges);
  }, [currentDepartmentId, currentLocationId, requirements, onUnsavedChanges]);

  const handleDepartmentSelect = (departmentId: string) => {
    setCurrentDepartmentId(parseInt(departmentId));
  };

  const handleLocationSelect = (locationId: string) => {
    setCurrentLocationId(parseInt(locationId));
  };

  const handleAddRequirement = () => {
    if (currentDepartmentId === null || currentLocationId === null) {
      return;
    }

    const department = departments.find((d) => d.id === currentDepartmentId);
    const location = locations.find((l) => l.id === currentLocationId);

    if (!department || !location) {
      return;
    }

    // Check if this combination already exists
    const exists = requirements.some(
      (req) =>
        req.departmentId === currentDepartmentId &&
        req.locationId === currentLocationId,
    );

    if (exists) {
      return;
    }

    const newRequirement: RequirementPair = {
      id: `${currentDepartmentId}-${currentLocationId}-${Date.now()}`,
      departmentId: currentDepartmentId,
      locationId: currentLocationId,
      departmentName: department.name,
      locationName: location.name,
    };

    const updatedRequirements = [...requirements, newRequirement];
    setRequirements(updatedRequirements);
    onChange?.(updatedRequirements);

    // Reset selections
    setCurrentDepartmentId(null);
    setCurrentLocationId(null);
  };

  const handleRemoveRequirement = (requirementId: string) => {
    const updatedRequirements = requirements.filter(
      (req) => req.id !== requirementId,
    );
    setRequirements(updatedRequirements);
    onChange?.(updatedRequirements);
  };

  const canAddRequirement = () => {
    return (
      currentDepartmentId !== null &&
      currentLocationId !== null &&
      !requirements.some(
        (req) =>
          req.departmentId === currentDepartmentId &&
          req.locationId === currentLocationId,
      )
    );
  };

  const hasUnsavedChanges =
    currentDepartmentId !== null &&
    currentLocationId !== null &&
    canAddRequirement();

  if (loading) {
    return <div>Loading requirements...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium mb-3">
          Required Department Locations
        </h4>

        {/* Add new requirement section */}
        <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <div className="flex-1">
            <DepartmentCombobox
              departments={departments}
              onSelect={handleDepartmentSelect}
              selectedDepartmentId={currentDepartmentId}
              placeholder="Select department..."
              disabled={disabled}
            />
          </div>
          <div className="flex-1">
            <LocationCombobox
              locations={locations}
              onSelect={handleLocationSelect}
              selectedLocationId={currentLocationId}
              placeholder="Select location..."
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            onClick={handleAddRequirement}
            disabled={!canAddRequirement() || disabled}
            size="icon"
            className={`shrink-0 ${hasUnsavedChanges ? "animate-pulse bg-amber-500 hover:bg-amber-600" : ""}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selected requirements list */}
      {requirements.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-muted-foreground">
            Selected Requirements ({requirements.length})
          </h5>
          <div className="space-y-2">
            {requirements.map((requirement) => (
              <Card key={requirement.id} className="p-0">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Department:
                          </span>
                          <span className="text-sm font-medium">
                            {requirement.departmentName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            Location:
                          </span>
                          <span className="text-sm font-medium">
                            {requirement.locationName}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRequirement(requirement.id)}
                      disabled={disabled}
                      className="shrink-0 h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {requirements.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          No requirements selected. Add department and location combinations
          above.
        </div>
      )}
    </div>
  );
}
