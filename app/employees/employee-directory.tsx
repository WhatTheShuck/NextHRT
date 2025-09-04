"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Search } from "lucide-react";
import { EmployeeAddForm } from "@/components/forms/employee-add-form";
import { EmployeeWithRelations } from "@/lib/types";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AxiosError } from "axios";

const EmployeeDirectory = () => {
  const router = useRouter();
  const session = useSession();
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const isAdmin = session?.data?.user?.role === "Admin";

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
      employee.firstName.toLowerCase().includes(searchLower) ||
      employee.lastName.toLowerCase().includes(searchLower) ||
      employee.title.toLowerCase().includes(searchLower) ||
      employee.department.name.toLowerCase().includes(searchLower) ||
      employee.location.name.toLowerCase().includes(searchLower);

    // Then filter by active status if toggle is on
    const matchesActiveFilter = showActiveOnly ? employee.isActive : true;

    return matchesSearch && matchesActiveFilter;
  });

  const handleRowClick = (employeeId: number) => {
    router.push(`/employees/${employeeId}`);
  };

  const handleSheetClose = () => {
    setIsSheetOpen(false);
    window.location.reload();
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
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Employee Directory</CardTitle>
            <CardDescription>
              Select an employee to view their records
            </CardDescription>
          </div>
          <div className="flex justify-between items-center space-x-2">
            <Switch
              id="activeEmployees"
              checked={showActiveOnly}
              onCheckedChange={setShowActiveOnly}
            />
            <Label htmlFor="activeEmployees">Active Only</Label>
            {isAdmin && (
              <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Employee
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Add New Employee</SheetTitle>
                  </SheetHeader>
                  <EmployeeAddForm onSuccess={handleSheetClose} />
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
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Loading employees...
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
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
                filteredEmployees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleRowClick(employee.id)}
                  >
                    <TableCell>
                      {employee.firstName} {employee.lastName}
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
