"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Plus,
  Search,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmployeeAddForm } from "@/components/forms/employee-add-form";
import { RowLink } from "@/components/ui/row-link";
import { EmployeeWithRelations } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AxiosError } from "axios";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";

type SortKey =
  | "firstName"
  | "lastName"
  | "title"
  | "department"
  | "location"
  | "status";
type SortDir = "asc" | "desc";

// Case-insensitive, locale-aware string comparison (reused across renders).
const collator = new Intl.Collator(undefined, { sensitivity: "base" });

const getSortValue = (
  employee: EmployeeWithRelations,
  key: SortKey,
): string => {
  switch (key) {
    case "firstName":
      return employee.legalFirstName;
    case "lastName":
      return employee.legalLastName;
    case "title":
      return employee.title;
    case "department":
      return employee.department.name;
    case "location":
      return employee.location.name;
    case "status":
      return employee.isActive ? "Active" : "Inactive";
  }
};

const EmployeeDirectory = () => {
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  // Default: alphabetical by first name (the most-requested ordering).
  const [sortKey, setSortKey] = useState<SortKey>("firstName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "Admin";

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        setError(null);

        const response =
          await api.get<EmployeeWithRelations[]>("/api/employees");
        setEmployees(response.data);
      } catch (error) {
        console.error("Error fetching employees:", error);
        if (error instanceof AxiosError) {
          if (error.response?.status === 401) {
            setError("You are not authenticated. Please log in.");
          } else if (error.response?.status === 403) {
            setError(
              "You do not have permission to view this data or no linked employee found. Please contact an administrator to link your account to your employee record.",
            );
          } else {
            setError("Failed to fetch employees. Please try again later.");
          }
        } else {
          setError("An unexpected error occurred.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  const filteredEmployees = employees.filter((employee) => {
    // First filter by search term
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      employee.legalFirstName.toLowerCase().includes(searchLower) ||
      employee.legalLastName.toLowerCase().includes(searchLower) ||
      (employee.preferredFirstName?.toLowerCase().includes(searchLower) ??
        false) ||
      (employee.preferredLastName?.toLowerCase().includes(searchLower) ??
        false) ||
      employee.title.toLowerCase().includes(searchLower) ||
      employee.department.name.toLowerCase().includes(searchLower) ||
      employee.location.name.toLowerCase().includes(searchLower);

    // Then filter by active status if toggle is on
    const matchesActiveFilter = showActiveOnly ? employee.isActive : true;

    return matchesSearch && matchesActiveFilter;
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const primary = collator.compare(
      getSortValue(a, sortKey),
      getSortValue(b, sortKey),
    );
    if (primary !== 0) return primary * dir;
    // Stable tiebreak by full name (ascending) so equal keys stay predictable.
    return (
      collator.compare(a.legalFirstName, b.legalFirstName) ||
      collator.compare(a.legalLastName, b.legalLastName)
    );
  });

  // Simple columns cycle asc → desc on the same key; a new key starts ascending.
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const setSort = (key: SortKey, dir: SortDir) => {
    setSortKey(key);
    setSortDir(dir);
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key)
      return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-2 h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="ml-2 h-3.5 w-3.5" />
    );
  };

  const isNameSort = sortKey === "firstName" || sortKey === "lastName";

  const handleAddSuccess = (employee?: EmployeeWithRelations) => {
    setIsSheetOpen(false);
    if (employee) {
      setEmployees((prev) => [...prev, employee]);
    }
  };

  if (error) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Employee Directory</CardTitle>
            <CardDescription>
              Select an employee to view their records
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch
                id="activeEmployees"
                checked={showActiveOnly}
                onCheckedChange={setShowActiveOnly}
              />
              <Label htmlFor="activeEmployees">Active Only</Label>
            </div>
            {isAdmin && (
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Add New Employee</SheetTitle>
                  </SheetHeader>
                  <EmployeeAddForm onSuccess={handleAddSuccess} />
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-6">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, title, department, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 data-[state=open]:bg-muted"
                      >
                        Name
                        {isNameSort ? (
                          sortDir === "asc" ? (
                            <ArrowUp className="ml-2 h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="ml-2 h-3.5 w-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {(
                        [
                          ["firstName", "asc", "First name (A–Z)"],
                          ["firstName", "desc", "First name (Z–A)"],
                          ["lastName", "asc", "Last name (A–Z)"],
                          ["lastName", "desc", "Last name (Z–A)"],
                        ] as [SortKey, SortDir, string][]
                      ).map(([key, dir, label]) => (
                        <DropdownMenuItem
                          key={`${key}-${dir}`}
                          onClick={() => setSort(key, dir)}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              sortKey === key && sortDir === dir
                                ? "opacity-100"
                                : "opacity-0"
                            }`}
                          />
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => toggleSort("title")}
                  >
                    Title
                    {sortIcon("title")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => toggleSort("department")}
                  >
                    Department
                    {sortIcon("department")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => toggleSort("location")}
                  >
                    Location
                    {sortIcon("location")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-3 h-8"
                    onClick={() => toggleSort("status")}
                  >
                    Status
                    {sortIcon("status")}
                  </Button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : sortedEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    {searchTerm
                      ? "No employees match your search"
                      : showActiveOnly
                        ? "No active employees found"
                        : "No employees found"}
                  </TableCell>
                </TableRow>
              ) : (
                sortedEmployees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    className="relative cursor-pointer hover:bg-muted"
                  >
                    <TableCell>
                      <RowLink
                        href={`/employees/${employee.id}`}
                        label={`${employee.legalFirstName} ${employee.legalLastName}`}
                      />
                      {employee.legalFirstName} {employee.legalLastName}
                    </TableCell>
                    <TableCell>{employee.title}</TableCell>
                    <TableCell>{employee.department.name}</TableCell>
                    <TableCell>
                      {employee.location.name}, {employee.location.state}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          employee.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {employee.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmployeeDirectory;
