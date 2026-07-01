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
import { useEffect, useState, useMemo } from "react";
import { JobFamily } from "@/generated/prisma_client/client";
import api from "@/lib/axios";
import { AddJobFamilyDialog } from "@/components/dialogs/job-family/add-job-family-dialog";
import { EditJobFamilyDialog } from "@/components/dialogs/job-family/edit-job-family-dialog";
import { DeleteJobFamilyDialog } from "@/components/dialogs/job-family/delete-job-family-dialog";
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

interface JobFamilyWithCount extends JobFamily {
  _count?: { employees: number };
}

const JobFamilyDirectory = () => {
  const [jobFamilies, setJobFamilies] = useState<JobFamilyWithCount[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<JobFamilyWithCount | null>(null);
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
        const { data } = await api.get<JobFamilyWithCount[]>("/api/job-families");
        setJobFamilies(data);
      } catch (err) {
        console.error("Error fetching job families:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleEdit = (record: JobFamilyWithCount) => {
    setSelectedRecord(record);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (record: JobFamilyWithCount) => {
    setSelectedRecord(record);
    setIsDeleteDialogOpen(true);
  };

  const columns = useMemo<ColumnDef<JobFamilyWithCount>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Job Family Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        id: "employees",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Employees" />
        ),
        accessorFn: (row) => row._count?.employees ?? 0,
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
                onClick={() => handleEdit(row.original)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(row.original)}
                disabled={employeeCount > 0}
                title={
                  employeeCount > 0
                    ? "Cannot delete job family with assigned employees"
                    : "Delete job family"
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
    [],
  );

  const table = useReactTable({
    data: jobFamilies,
    columns,
    state: { sorting, columnFilters, globalFilter },
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

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Job Family Management</CardTitle>
              <CardDescription>
                Manage job families and view employee assignments. Showing{" "}
                {table.getFilteredRowModel().rows.length} of {jobFamilies.length}{" "}
                job {jobFamilies.length !== 1 ? "families" : "family"}
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Job Family
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search job families..."
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
            <div className="text-center text-muted-foreground py-8">
              Loading job families...
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
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
                        ? "No job families match your filters"
                        : "No job families found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

      <AddJobFamilyDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onJobFamilyAdded={(jf) => {
          setJobFamilies([...jobFamilies, { ...jf, _count: { employees: 0 } }]);
        }}
      />

      <EditJobFamilyDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        jobFamily={selectedRecord}
        onJobFamilyUpdated={(updated) => {
          setJobFamilies((prev) =>
            prev.map((jf) => (jf.id === updated.id ? { ...jf, ...updated } : jf)),
          );
        }}
      />

      <DeleteJobFamilyDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        jobFamily={selectedRecord}
        onJobFamilyDeleted={(deleted) => {
          setJobFamilies((prev) => prev.filter((jf) => jf.id !== deleted.id));
        }}
      />
    </div>
  );
};

export default JobFamilyDirectory;
