"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Department, User, UserRole } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { EditUserRoleDialog } from "@/components/dialogs/user/edit-user-role-dialog";

export function UserRoleManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Fetch users and departments
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch users
        const usersResponse = await api.get<User[]>("/api/users");
        setUsers(usersResponse.data);
        setFilteredUsers(usersResponse.data);

        // Fetch departments
        const departmentsResponse = await api.get<Department[]>(
          "/api/departments?activeOnly=true",
        );
        setDepartments(departmentsResponse.data);
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

  // Handle user selection for editing
  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setOpenDialog(true);
  };

  const handleViewProfile = (user: User) => {
    // Navigate to user profile page
    router.push(`/profile/${user.id}`);
  };

  // Handle user update from dialog
  const handleUserUpdated = (updatedUser: User) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
  };

  if (loading && users.length === 0) {
    return <div className="flex justify-center my-8">Loading users...</div>;
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
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Current Role</TableHead>
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
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role || "No Role"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewProfile(user)}
                        disabled={loading}
                      >
                        View Profile
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                        disabled={loading}
                      >
                        Edit Role
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EditUserRoleDialog
        open={openDialog}
        onOpenChange={setOpenDialog}
        user={selectedUser}
        departments={departments}
        onUserUpdated={handleUserUpdated}
      />
    </div>
  );
}

// Helper function for badge styling
function getRoleBadgeVariant(
  role: UserRole | null,
): "default" | "outline" | "secondary" | "destructive" {
  switch (role) {
    case "Admin":
      return "destructive";
    case "DepartmentManager":
      return "secondary";
    case "FireWarden":
      return "secondary";
    case "User":
      return "default";
    default:
      return "outline";
  }
}
