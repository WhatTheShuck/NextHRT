"use client";

import { useState, useEffect } from "react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, LinkIcon, Link2Off } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { EmployeeWithRelations } from "@/lib/types";
import { User } from "@/generated/prisma_client";

export function UserEmployeeMapping() {
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

  // Fetch users and employees
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch users with their employee links
        const usersResponse = await api.get<User[]>(
          "/api/users?includeEmployee=true",
        );
        setUsers(usersResponse.data);
        setFilteredUsers(usersResponse.data);

        // Fetch employees
        const employeesResponse =
          await api.get<EmployeeWithRelations[]>("/api/employees");
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

  // Filter users based on search term
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

  // Handle user selection for mapping
  const handleMapUser = (user: User) => {
    setSelectedUserId(user.id);
    setSelectedEmployeeId(user.employeeId ? String(user.employeeId) : null);
    setOpenDialog(true);
  };

  // Handle unlinking employee from user
  const handleUnlinkEmployee = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      await api.delete(`/api/users/${userId}/employee`);

      // Update local state
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

  // Handle save mapping
  const handleSaveMapping = async () => {
    if (!selectedUserId) return;

    try {
      setLoading(true);
      setError(null);

      await api.put(`/api/users/${selectedUserId}/employee`, {
        employeeId: selectedEmployeeId ? parseInt(selectedEmployeeId) : null,
      });

      // Update local state
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

  // Get employee full name for display
  const getEmployeeById = (id: number | null) => {
    if (!id) return null;
    const employee = employees.find((emp) => emp.id === id);
    return employee
      ? `${employee.firstName} ${employee.lastName}`
      : "Unknown Employee";
  };

  if (loading && users.length === 0) {
    return <div className="flex justify-center my-8">Loading data...</div>;
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

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Map User to Employee</DialogTitle>
            <DialogDescription>
              Link this user account to an employee record.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="employee-select" className="text-sm font-medium">
                Employee
              </label>
              <Select
                value={selectedEmployeeId || ""}
                onValueChange={setSelectedEmployeeId}
              >
                <SelectTrigger id="employee-select">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {/* <SelectItem value="">-- None (Remove Mapping) --</SelectItem> */}
                  {employees.map((employee) => (
                    <SelectItem
                      key={employee.id}
                      value={employee.id.toString()}
                    >
                      {employee.firstName} {employee.lastName} -{" "}
                      {employee.title} ({employee.department.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveMapping} disabled={loading}>
              {loading ? "Saving..." : "Save Mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
