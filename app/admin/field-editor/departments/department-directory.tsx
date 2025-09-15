"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddDepartmentDialog } from "@/components/dialogs/department/add-department-dialog";
import { useEffect, useState } from "react";
import { Department } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { EditDepartmentDialog } from "@/components/dialogs/department/edit-department-dialog";
import { DeleteDepartmentDialog } from "@/components/dialogs/department/delete-department-dialog";

// Extended type to include employee count
interface DepartmentWithCount extends Department {
  _count?: {
    employees: number;
    activeEmployees: number;
  };
}

const DepartmentsDirectory = () => {
  const [departments, setDepartments] = useState<DepartmentWithCount[]>([]);
  const [isDepartmentAddDialogOpen, setIsDepartmentAddDialogOpen] =
    useState(false);
  const [isDepartmentEditDialogOpen, setIsDepartmentEditDialogOpen] =
    useState(false);
  const [isDepartmentDeleteDialogOpen, setIsDepartmentDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<DepartmentWithCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: departmentsRes } =
          await api.get<DepartmentWithCount[]>("/api/departments");
        setDepartments(departmentsRes);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditDepartment = (record: DepartmentWithCount) => {
    setSelectedRecord(record);
    setIsDepartmentEditDialogOpen(true);
  };

  const handleDeleteDepartment = (record: DepartmentWithCount) => {
    setSelectedRecord(record);
    setIsDepartmentDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Department Management</CardTitle>
              <CardDescription>
                Manage departments and view employee assignments. Showing{" "}
                {departments.length} department
                {departments.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button onClick={() => setIsDepartmentAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center text-muted-foreground">
              Loading departments...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department Name</TableHead>
                  <TableHead>Parent Department</TableHead>
                  <TableHead>Total Employees</TableHead>
                  <TableHead>Active Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-center text-muted-foreground"
                    >
                      No departments found
                    </TableCell>
                  </TableRow>
                ) : (
                  departments
                    .sort((a, b) =>
                      a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1,
                    )
                    .map((record: DepartmentWithCount) => {
                      const employeeCount = record._count?.employees || 0;
                      const activeEmployeeCount =
                        record._count?.activeEmployees || 0;
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.name}
                          </TableCell>
                          <TableCell>
                            {record.parentDepartmentId
                              ? departments.find(
                                  (dept) =>
                                    dept.id === record.parentDepartmentId,
                                )?.name || "N/A"
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            {employeeCount}{" "}
                            {employeeCount === 1 ? "employee" : "employees"}
                          </TableCell>
                          <TableCell>
                            {activeEmployeeCount}{" "}
                            {activeEmployeeCount === 1
                              ? "employee"
                              : "employees"}
                          </TableCell>
                          <TableCell>
                            {" "}
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                record.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {record.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDepartment(record)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteDepartment(record)}
                                disabled={employeeCount > 0}
                                title={
                                  employeeCount > 0
                                    ? "Cannot delete department with assigned employees"
                                    : "Delete department"
                                }
                              >
                                <Trash className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {/* Dialogs */}
      <AddDepartmentDialog
        open={isDepartmentAddDialogOpen}
        onOpenChange={setIsDepartmentAddDialogOpen}
        onDepartmentAdded={(dept) => {
          setDepartments([...departments, dept]);
        }}
        departments={departments}
      />

      <EditDepartmentDialog
        open={isDepartmentEditDialogOpen}
        onOpenChange={setIsDepartmentEditDialogOpen}
        department={selectedRecord}
        onDepartmentUpdated={(updatedDept) => {
          setDepartments((prev) =>
            prev.map((dept) =>
              dept.id === updatedDept.id ? updatedDept : dept,
            ),
          );
        }}
        departments={departments}
      />

      <DeleteDepartmentDialog
        open={isDepartmentDeleteDialogOpen}
        onOpenChange={setIsDepartmentDeleteDialogOpen}
        department={selectedRecord}
        onDepartmentDeleted={(deletedDept) => {
          setDepartments((prev) =>
            prev.filter((dept) => dept.id !== deletedDept.id),
          );
        }}
      />
    </div>
  );
};

export default DepartmentsDirectory;
