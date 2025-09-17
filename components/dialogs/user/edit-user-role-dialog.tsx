"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "usehooks-ts";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Department, User, UserRole } from "@/generated/prisma_client";

interface EditUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  departments: Department[];
  onUserUpdated?: (user: User) => void;
}

interface UserRoleFormProps {
  user: User | null;
  departments: Department[];
  onUserUpdated?: (user: User) => void;
  onClose: () => void;
  className?: string;
}

function UserRoleForm({
  user,
  departments,
  onUserUpdated,
  onClose,
  className,
}: UserRoleFormProps) {
  const [selectedUserRole, setSelectedUserRole] = useState<UserRole | null>(
    null,
  );
  const [selectedUserDepartments, setSelectedUserDepartments] = useState<
    number[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sort departments by parent departments first, then child departments grouped under their parents
  const getSortedDepartments = () => {
    const parentDepartments = departments.filter((dept) => dept.level === 0);
    const childDepartments = departments.filter((dept) => dept.level === 1);

    const sortedDepartments: Department[] = [];

    // Add each parent department followed by its children
    parentDepartments.forEach((parent) => {
      sortedDepartments.push(parent);

      // Find and add children of this parent
      const children = childDepartments.filter(
        (child) => child.parentDepartmentId === parent.id,
      );
      sortedDepartments.push(...children);
    });

    // Add any orphaned child departments (children without a parent in the list)
    const orphanedChildren = childDepartments.filter(
      (child) =>
        !parentDepartments.some(
          (parent) => parent.id === child.parentDepartmentId,
        ),
    );
    sortedDepartments.push(...orphanedChildren);

    return sortedDepartments;
  };

  // Load user data when user changes
  useEffect(() => {
    if (user) {
      setSelectedUserRole(user.role);

      // Fetch user's managed departments
      const fetchUserDepartments = async () => {
        try {
          const response = await api.get<Department[]>(
            `/api/users/${user.id}/departments`,
          );
          setSelectedUserDepartments(
            response.data.map((dept: Department) => dept.id),
          );
        } catch (error) {
          console.error("Error fetching user departments:", error);
          setSelectedUserDepartments([]);
        }
      };

      fetchUserDepartments();
    }
  }, [user]);

  // Handle department selection
  const toggleDepartment = (deptId: number) => {
    setSelectedUserDepartments((prev) =>
      prev.includes(deptId)
        ? prev.filter((id) => id !== deptId)
        : [...prev, deptId],
    );
  };

  const resetForm = () => {
    setSelectedUserRole(null);
    setSelectedUserDepartments([]);
    setError(null);
  };

  // Handle role update
  const handleSaveChanges = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      await api.patch(`/api/users/${user.id}`, {
        role: selectedUserRole,
        managedDepartmentIds:
          selectedUserRole === "DepartmentManager"
            ? selectedUserDepartments
            : [],
      });

      // Create updated user object
      const updatedUser = { ...user, role: selectedUserRole as UserRole };
      onUserUpdated?.(updatedUser);
      onClose();
      resetForm();
    } catch (error: any) {
      console.error("Error updating user:", error);

      if (error.response?.status === 401) {
        setError("You are not authenticated. Please log in.");
      } else if (error.response?.status === 403) {
        setError("You do not have permission to perform this action.");
      } else {
        setError("Failed to update user. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  if (!user) return null;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="role-select">Role</Label>
        <Select
          value={selectedUserRole || "NONE"}
          onValueChange={(value) =>
            setSelectedUserRole(value === "NONE" ? null : (value as UserRole))
          }
          disabled={loading}
        >
          <SelectTrigger id="role-select">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">No Role</SelectItem>
            <SelectItem value="User">User</SelectItem>
            <SelectItem value="FireWarden">Fire Warden</SelectItem>
            <SelectItem value="DepartmentManager">
              Department Manager
            </SelectItem>
            <SelectItem value="Admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedUserRole === "DepartmentManager" && (
        <div className="space-y-2">
          <Label>Managed Departments</Label>
          <div className="max-h-40 overflow-y-auto p-2 border rounded-md space-y-3">
            {getSortedDepartments()
              .filter((dept) => dept.level === 0)
              .map((dept) => {
                const children = getSortedDepartments().filter(
                  (child) =>
                    child.level === 1 && child.parentDepartmentId === dept.id,
                );

                return (
                  <div key={dept.id} className="space-y-2">
                    <div className="flex items-center space-x-2 p-2 rounded">
                      <input
                        type="checkbox"
                        id={`dept-${dept.id}`}
                        checked={selectedUserDepartments.includes(dept.id)}
                        onChange={() => toggleDepartment(dept.id)}
                        className="h-4 w-4 rounded"
                        disabled={loading}
                      />
                      <label
                        htmlFor={`dept-${dept.id}`}
                        className="text-sm font-medium"
                      >
                        {dept.name}
                      </label>
                    </div>
                    {children.length > 0 && (
                      <div className="ml-6 space-y-1">
                        {children.map((child) => (
                          <div
                            key={child.id}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={`dept-${child.id}`}
                              checked={selectedUserDepartments.includes(
                                child.id,
                              )}
                              onChange={() => toggleDepartment(child.id)}
                              className="h-4 w-4 rounded"
                              disabled={loading}
                            />
                            <label
                              htmlFor={`dept-${child.id}`}
                              className="text-sm text-muted-foreground"
                            >
                              {child.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          {departments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No departments available
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200">
          {error}
        </div>
      )}

      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button onClick={handleSaveChanges} disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
        <Button variant="outline" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function EditUserRoleDialog({
  open,
  onOpenChange,
  user,
  departments,
  onUserUpdated,
}: EditUserRoleDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User Role</DialogTitle>
            <DialogDescription>
              Update the role and permissions for {user?.name || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <UserRoleForm
              user={user}
              departments={departments}
              onUserUpdated={onUserUpdated}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit User Role</DrawerTitle>
          <DrawerDescription>
            Update the role and permissions for {user?.name || "this user"}.
          </DrawerDescription>
        </DrawerHeader>
        <UserRoleForm
          className="px-4"
          user={user}
          departments={departments}
          onUserUpdated={onUserUpdated}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}
