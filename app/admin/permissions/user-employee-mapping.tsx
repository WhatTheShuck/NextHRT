"use client";

import { useState, useEffect } from "react";
import { useMediaQuery } from "usehooks-ts";
import { Button } from "@/components/ui/button";
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
import {
  GenericCombobox,
  ComboboxItem,
  createComboboxItem,
} from "@/components/ui/generic-combobox";
import { Search, LinkIcon, Link2Off } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { EmployeeWithRelations } from "@/lib/types";
import { User } from "@/generated/prisma_client/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface MappingFormProps {
  selectedEmployeeId: string | null;
  onEmployeeSelect: (item: ComboboxItem | null) => void;
  employeeItems: ComboboxItem[];
  loading: boolean;
  onClose: () => void;
  onSave: () => void;
  className?: string;
}

function MappingForm({
  selectedEmployeeId,
  onEmployeeSelect,
  employeeItems,
  loading,
  onClose,
  onSave,
  className,
}: MappingFormProps) {
  const selectedItem =
    employeeItems.find((item) => item.id.toString() === selectedEmployeeId) ||
    null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="employee-select">Employee</Label>
        <GenericCombobox
          items={employeeItems}
          selectedItem={selectedItem}
          onSelect={onEmployeeSelect}
          placeholder="Select Employee"
          searchPlaceholder="Search employees..."
          emptyMessage="No employees found."
          allowClear={true}
          clearLabel="No employee (unlink)"
          width="w-full"
          showSubtitle={true}
          disabled={loading}
        />
      </div>
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button onClick={onSave} disabled={loading}>
          {loading ? "Saving..." : "Save Mapping"}
        </Button>
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function UserEmployeeMapping() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [openDialog, setOpenDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const usersResponse = await api.get<User[]>(
          "/api/users?includeEmployee=true",
        );
        setUsers(usersResponse.data);
        setFilteredUsers(usersResponse.data);

        const employeesResponse = await api.get<EmployeeWithRelations[]>(
          "/api/employees?activeOnly=true",
        );
        setEmployees(employeesResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
        if (error instanceof AxiosError) {
          if (error.response?.status === 401) {
            setError("You are not authenticated. Please log in.");
          } else if (error.response?.status === 403) {
            setError("You do not have permission to view this data.");
          } else {
            setError("Failed to fetch data. Please try again later.");
          }
        } else {
          setError("An unexpected error occurred.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const lowercasedSearchTerm = searchTerm.toLowerCase();
    const filtered = users.filter(
      (user) =>
        user.name?.toLowerCase().includes(lowercasedSearchTerm) ||
        user.email?.toLowerCase().includes(lowercasedSearchTerm),
    );
    setFilteredUsers(filtered);
  }, [searchTerm, users]);

  const handleMapUser = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedEmployeeId(user.employeeId ? String(user.employeeId) : null);
    setOpenDialog(true);
  };

  const handleUnlinkEmployee = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      await api.delete(`/api/users/${userId}/employee`);

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === userId ? { ...user, employeeId: null } : user,
        ),
      );
    } catch (error) {
      console.error("Error unlinking employee:", error);
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          setError("You are not authenticated. Please log in.");
        } else if (error.response?.status === 403) {
          setError("You do not have permission to perform this action.");
        } else {
          setError("Failed to unlink employee. Please try again later.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedUserId) return;

    try {
      setLoading(true);
      setError(null);

      await api.put(`/api/users/${selectedUserId}/employee`, {
        employeeId: selectedEmployeeId ? parseInt(selectedEmployeeId) : null,
      });

      setUsers((prevUsers) =>
        prevUsers.map((user) =>
          user.id === selectedUserId
            ? {
                ...user,
                employeeId: selectedEmployeeId
                  ? parseInt(selectedEmployeeId)
                  : null,
              }
            : user,
        ),
      );

      setOpenDialog(false);
    } catch (error) {
      console.error("Error updating mapping:", error);
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          setError("You are not authenticated. Please log in.");
        } else if (error.response?.status === 403) {
          setError("You do not have permission to perform this action.");
        } else if (error.response?.status === 409) {
          setError("This employee is already linked to another user.");
        } else {
          setError("Failed to update mapping. Please try again later.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const getEmployeeById = (id: number | null) => {
    if (!id) return null;
    const employee = employees.find((emp) => emp.id === id);
    return employee
      ? `${employee.legalFirstName} ${employee.legalLastName}`
      : "Unknown Employee";
  };

  const employeeItems: ComboboxItem[] = employees.map((employee) =>
    createComboboxItem(
      employee.id,
      `${employee.legalFirstName} ${employee.legalLastName}`,
      `${employee.legalFirstName} ${employee.legalLastName} ${employee.preferredFirstName ?? ""} ${employee.preferredLastName ?? ""} ${employee.title} ${employee.department.name}`,
      `${employee.title} - ${employee.department.name}`,
    ),
  );

  const handleEmployeeSelect = (item: ComboboxItem | null) => {
    setSelectedEmployeeId(item ? String(item.id) : null);
  };

  if (loading && users.length === 0) {
    return (
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Skeleton className="h-9 flex-1" />
        </div>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Linked Employee</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-36 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Skeleton className="h-8 w-16" />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center my-8 p-4 border border-red-200 rounded-md bg-red-50">
        <p className="text-red-600 mb-2">Error: {error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const mappingFormProps = {
    selectedEmployeeId,
    onEmployeeSelect: handleEmployeeSelect,
    employeeItems,
    loading,
    onClose: () => setOpenDialog(false),
    onSave: handleSaveMapping,
  };

  return (
    <div>
      <div className="flex items-center space-x-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Linked Employee</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4">
                  {searchTerm
                    ? "No users found matching your search"
                    : "No users found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.name || "N/A"}
                  </TableCell>
                  <TableCell>{user.email || "N/A"}</TableCell>
                  <TableCell>
                    {user.employeeId ? (
                      <Badge variant="outline" className="font-normal">
                        {getEmployeeById(user.employeeId)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        Not linked
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMapUser(user)}
                        disabled={loading}
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        Map
                      </Button>

                      {user.employeeId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnlinkEmployee(user.id)}
                          disabled={loading}
                          className="text-destructive border-destructive hover:bg-destructive/10"
                        >
                          <Link2Off className="h-4 w-4 mr-1" />
                          Unlink
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {isDesktop ? (
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Map User to Employee</DialogTitle>
              <DialogDescription>
                Link this user account to an employee record.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <MappingForm {...mappingFormProps} />
            </div>
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={openDialog} onOpenChange={setOpenDialog}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="text-left">
              <DrawerTitle>Map User to Employee</DrawerTitle>
              <DrawerDescription>
                Link this user account to an employee record.
              </DrawerDescription>
            </DrawerHeader>
            <MappingForm className="px-4" {...mappingFormProps} />
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
