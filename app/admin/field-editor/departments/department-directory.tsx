"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Search } from "lucide-react";
import { SortableColumnHeader } from "@/components/sortable-column-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AddDepartmentDialog } from "@/components/dialogs/department/add-department-dialog";
import { useEffect, useState, useMemo } from "react";
import { Department } from "@/generated/prisma_client/client";
import api from "@/lib/axios";
import { EditDepartmentDialog } from "@/components/dialogs/department/edit-department-dialog";
import { DeleteDepartmentDialog } from "@/components/dialogs/department/delete-department-dialog";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

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
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "isActive", desc: true },
  ]);

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

  const columns = useMemo<ColumnDef<DepartmentWithCount>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Department Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "parentDepartment",
        header: "Parent Department",
        accessorFn: (row) =>
          departments.find((d) => d.id === row.parentDepartmentId)?.name ??
          "N/A",
        enableGlobalFilter: false,
      },
      {
        id: "totalEmployees",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Total Employees" />
        ),
        accessorFn: (row) => row._count?.employees ?? 0,
        cell: ({ getValue }) => {
          const count = getValue() as number;
          return `${count} ${count === 1 ? "employee" : "employees"}`;
        },
        enableGlobalFilter: false,
      },
      {
        id: "activeEmployees",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Active Employees" />
        ),
        accessorFn: (row) => row._count?.activeEmployees ?? 0,
        cell: ({ getValue }) => {
          const count = getValue() as number;
          return `${count} ${count === 1 ? "employee" : "employees"}`;
        },
        enableGlobalFilter: false,
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Status" />
        ),
        cell: ({ row }) => (
          <span
            className={`px-2 py-1 rounded-full text-xs ${
              row.original.isActive
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {row.original.isActive ? "Active" : "Inactive"}
          </span>
        ),
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true;
          return filterValue === "active"
            ? row.getValue(columnId) === true
            : row.getValue(columnId) === false;
        },
        enableGlobalFilter: false,
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => {
          const employeeCount = row.original._count?.employees || 0;
          return (
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditDepartment(row.original)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteDepartment(row.original)}
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
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [departments],
  );

  const table = useReactTable({
    data: departments,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  const statusFilterValue =
    (table.getColumn("isActive")?.getFilterValue() as string) ?? "all";

  const mobileHiddenCols = new Set([
    "parentDepartment",
    "totalEmployees",
    "activeEmployees",
  ]);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Department Management</CardTitle>
              <CardDescription>
                Manage departments and view employee assignments. Showing{" "}
                {table.getFilteredRowModel().rows.length} of {departments.length}{" "}
                department
                {departments.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button onClick={() => setIsDepartmentAddDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Department
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search departments..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilterValue}
              onValueChange={(value) => {
                table
                  .getColumn("isActive")
                  ?.setFilterValue(value === "all" ? undefined : value);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isLoading ? (
            <div className="text-center text-muted-foreground">
              Loading departments...
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={
                          mobileHiddenCols.has(header.id)
                            ? "hidden md:table-cell"
                            : undefined
                        }
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="text-center text-muted-foreground"
                    >
                      {globalFilter || columnFilters.length > 0
                        ? "No departments match your filters"
                        : "No departments found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            mobileHiddenCols.has(cell.column.id)
                              ? "hidden md:table-cell"
                              : undefined
                          }
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
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
          setDepartments([
            ...departments,
            { ...dept, _count: { employees: 0, activeEmployees: 0 } },
          ]);
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
              dept.id === updatedDept.id ? { ...dept, ...updatedDept } : dept,
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
