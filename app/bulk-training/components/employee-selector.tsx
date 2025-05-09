"use client";
import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Employee } from "@/generated/prisma_client";
import { useDebounce } from "@/hooks/use-debounce";
import { CheckIcon } from "lucide-react";

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);
  const debouncedSearchTerm = useDebounce(searchInput, 300);
  const containerRef = useRef<HTMLDivElement>(null);
  const badgeRowRef = useRef<HTMLDivElement>(null);

  // Calculate how many badges can fit in a single row
  const calculateVisibleCount = useCallback(() => {
    if (
      !badgeRowRef.current ||
      !containerRef.current ||
      selectedEmployees.length === 0
    ) {
      return 0;
    }

    const containerWidth = containerRef.current.clientWidth;
    const padding = 16; // Account for container padding
    const badgeGap = 8; // Gap between badges
    const moreButtonWidth = 80; // Estimated width for "+X more" button
    const toggleButtonWidth = 100; // Estimated width for "Show all" button

    let availableWidth = containerWidth - padding - toggleButtonWidth;
    if (selectedEmployees.length > 1) {
      availableWidth -= moreButtonWidth;
    }

    let totalWidth = 0;
    let count = 0;

    // Create a temporary element to measure badge widths
    const tempDiv = document.createElement("div");
    tempDiv.style.position = "absolute";
    tempDiv.style.visibility = "hidden";
    tempDiv.style.display = "inline-block";
    document.body.appendChild(tempDiv);

    for (let i = 0; i < selectedEmployees.length; i++) {
      const employee = selectedEmployees[i];
      // Estimate badge width based on text content
      tempDiv.textContent = `${employee.firstName} ${employee.lastName}`;
      const badgeWidth = tempDiv.offsetWidth + 40; // Add padding and close button width

      if (
        totalWidth + badgeWidth + (count > 0 ? badgeGap : 0) >
        availableWidth
      ) {
        break;
      }

      totalWidth += badgeWidth + (count > 0 ? badgeGap : 0);
      count++;
    }

    document.body.removeChild(tempDiv);
    return Math.max(1, count); // Show at least one badge
  }, [selectedEmployees]);

  // Recalculate visible badges on resize or selection change
  useEffect(() => {
    const handleResize = () => {
      const newVisibleCount = calculateVisibleCount();
      setVisibleCount(newVisibleCount);
    };

    // Initial calculation
    handleResize();

    // Add resize listener
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [calculateVisibleCount, selectedEmployees]);

  // Toggle dropdown expanded state
  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent form submission
    e.preventDefault(); // Prevent default action (form submission)
    setIsExpanded((prev) => !prev);
  }, []);

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
    (employeeId: number, event?: React.MouseEvent) => {
      if (event) {
        event.stopPropagation();
      }
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

  // Determine visible employees based on expanded state
  const visibleEmployees = useMemo(() => {
    if (isExpanded) return selectedEmployees;
    return selectedEmployees.slice(0, visibleCount);
  }, [selectedEmployees, isExpanded, visibleCount]);

  const hiddenCount = selectedEmployees.length - visibleEmployees.length;

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

      <div className="border rounded-md p-2" ref={containerRef}>
        {/* Selected employees display */}
        <div className="mb-3" ref={badgeRowRef}>
          <div className="flex flex-wrap gap-2 min-h-10 items-center">
            {/* Badge container with conditional height limit */}
            <div
              className={`flex flex-wrap gap-2 items-center ${
                !isExpanded ? "max-h-10 overflow-hidden" : ""
              }`}
            >
              {selectedEmployees.length === 0 ? (
                <span className="text-sm text-muted-foreground italic">
                  No employees selected
                </span>
              ) : (
                <>
                  {visibleEmployees.map((employee) => (
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
                        onClick={(e) => removeEmployee(employee.id, e)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}

                  {/* Show count of hidden employees when collapsed */}
                  {!isExpanded && hiddenCount > 0 && (
                    <Badge
                      variant="outline"
                      className="cursor-pointer"
                      onClick={toggleExpanded}
                    >
                      +{hiddenCount} more
                    </Badge>
                  )}
                </>
              )}
            </div>

            {/* Toggle button - on the same row */}
            {selectedEmployees.length > 0 &&
              (hiddenCount > 0 || isExpanded) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsExpanded((prev) => !prev);
                  }}
                  className="h-6 px-2 text-xs flex items-center gap-1 ml-auto"
                >
                  {isExpanded ? "Collapse" : "Show all"}
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              )}
          </div>
        </div>

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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                selectAllFiltered(filteredEmployees);
              }}
            >
              Select all
            </Button>
          </div>
        )}

        {/* Employee list with checkboxes */}
        <div className="mt-1 h-48 overflow-y-auto border-t border-b">
          {filteredEmployees.length === 0 ? (
            <p className="text-sm text-muted-foreground p-2">
              No employees found
            </p>
          ) : (
            <div className="py-1">
              {filteredEmployees.map((employee) => (
                <div
                  key={employee.id}
                  className={`flex items-center p-2 rounded-md cursor-pointer ${
                    selectedEmployees.some((e) => e.id === employee.id)
                      ? "bg-primary/10 font-medium"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => toggleEmployeeSelection(employee)}
                >
                  <div className="flex-shrink-0 w-5 mr-2 flex items-center justify-center">
                    {selectedEmployees.some((e) => e.id === employee.id) && (
                      <CheckIcon className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <span className="flex-1 text-sm">
                    {employee.firstName} {employee.lastName} - {employee.Title}
                  </span>
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
