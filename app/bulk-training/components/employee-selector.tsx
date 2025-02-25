"use client";
import React, { useState, useCallback, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import { Employee } from "@prisma/client";
import { useDebounce } from "@/hooks/use-debounce";

type EmployeeSelectorProps = {
  employees: Employee[];
  selectedEmployees: Employee[];
  onSelectionChange: (employees: Employee[]) => void;
};

export function EmployeeSelector({
  employees,
  selectedEmployees,
  onSelectionChange,
}: EmployeeSelectorProps) {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearchTerm = useDebounce(searchInput, 300);

  // Toggle employee selection
  const toggleEmployeeSelection = useCallback(
    (employee: Employee) => {
      if (selectedEmployees.some((e) => e.id === employee.id)) {
        onSelectionChange(
          selectedEmployees.filter((e) => e.id !== employee.id),
        );
      } else {
        onSelectionChange([...selectedEmployees, employee]);
      }
    },
    [selectedEmployees, onSelectionChange],
  );

  // Remove a single employee
  const removeEmployee = useCallback(
    (employeeId: number) => {
      onSelectionChange(selectedEmployees.filter((e) => e.id !== employeeId));
    },
    [selectedEmployees, onSelectionChange],
  );

  // Clear all selected employees
  const clearAllSelected = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Select all filtered employees
  const selectAllFiltered = useCallback(
    (filteredEmployees: Employee[]) => {
      // Create a new array with unique employees by merging current selection and filtered employees
      const uniqueEmployees = [...selectedEmployees];

      filteredEmployees.forEach((employee) => {
        if (!uniqueEmployees.some((e) => e.id === employee.id)) {
          uniqueEmployees.push(employee);
        }
      });

      onSelectionChange(uniqueEmployees);
    },
    [selectedEmployees, onSelectionChange],
  );

  // Filter employees based on search term
  const filteredEmployees = useMemo(() => {
    if (!debouncedSearchTerm) return employees;

    return employees.filter((employee) => {
      const searchTermLower = debouncedSearchTerm.toLowerCase();
      const fullName =
        `${employee.firstName} ${employee.lastName} ${employee.Title}`.toLowerCase();

      return fullName.includes(searchTermLower);
    });
  }, [employees, debouncedSearchTerm]);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label>Employees</Label>
        {selectedEmployees.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllSelected}
            className="h-6 px-2 text-xs"
          >
            Clear all
          </Button>
        )}
      </div>

      <div className="border rounded-md p-2">
        {/* Selected employees display */}
        {selectedEmployees.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {selectedEmployees.map((employee) => (
              <Badge
                key={employee.id}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {employee.firstName} {employee.lastName}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={() => removeEmployee(employee.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employees by name or title..."
            className="pl-8"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {/* Employee list header with select all */}
        {filteredEmployees.length > 0 && (
          <div className="flex items-center justify-between mt-2 px-2 py-1 border-b">
            <span className="text-sm font-medium">
              {filteredEmployees.length} employee(s) found
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => selectAllFiltered(filteredEmployees)}
            >
              Select all
            </Button>
          </div>
        )}

        {/* Employee list with checkboxes */}
        <div className="mt-1 max-h-48 overflow-y-auto">
          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">
              No employees found
            </p>
          ) : (
            <div className="space-y-1">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md"
                >
                  <Checkbox
                    id={`employee-${employee.id}`}
                    checked={selectedEmployees.some(
                      (e) => e.id === employee.id,
                    )}
                    onCheckedChange={() => toggleEmployeeSelection(employee)}
                  />
                  <Label
                    htmlFor={`employee-${employee.id}`}
                    className="flex-1 cursor-pointer text-sm"
                  >
                    {employee.firstName} {employee.lastName} - {employee.Title}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected count */}
        <div className="mt-2 text-sm text-muted-foreground border-t pt-2">
          {selectedEmployees.length} employee(s) selected
        </div>
      </div>
    </div>
  );
}
