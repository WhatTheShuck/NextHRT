"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, Users, MapPin, Search } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { NewTrainingDialog } from "@/components/dialogs/training/add-training-dialog";
import { useEffect, useState, useMemo } from "react";
import api from "@/lib/axios";
import { EditTrainingDialog } from "@/components/dialogs/training/edit-training-dialog";
import { DeleteTrainingDialog } from "@/components/dialogs/training/delete-training-dialog";
import { TrainingWithRelations } from "@/lib/types";
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

const RequirementsCell = ({
  training,
}: {
  training: TrainingWithRelations;
}) => {
  const requirementCount = training.requirements?.length || 0;

  if (requirementCount === 0) {
    return <span className="text-muted-foreground">No requirements</span>;
  }

  const requirementText = training.requirements
    ?.map(
      (req) =>
        `${req.department?.name} @ ${req.location?.name}, ${req.location?.state}`,
    )
    .join("\n");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>
              {requirementCount} requirement
              {requirementCount !== 1 ? "s" : ""}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="whitespace-pre-line text-sm">
            <strong>Required for:</strong>
            <br />
            {requirementText}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ExemptionsCell = ({
  training,
}: {
  training: TrainingWithRelations;
}) => {
  const activeExemptions =
    training.trainingExemptions?.filter((e) => e.status === "Active") || [];
  const exemptionCount = activeExemptions.length;

  if (exemptionCount === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  const exemptionText = activeExemptions
    .map((exemption) => {
      const expiryText = exemption.endDate
        ? ` (expires ${new Date(exemption.endDate).toLocaleDateString()})`
        : " (permanent)";
      return `${exemption.employee?.firstName} ${exemption.employee?.lastName}: ${exemption.reason}${expiryText}`;
    })
    .join("\n");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help">
            <Users className="h-4 w-4 text-amber-600" />
            <span className="text-amber-700">
              {exemptionCount} employee{exemptionCount !== 1 ? "s" : ""}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="whitespace-pre-line text-sm">
            <strong>Exempt employees:</strong>
            <br />
            {exemptionText}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const TrainingDirectory = () => {
  const [trainings, setTrainings] = useState<TrainingWithRelations[]>([]);
  const [isTrainingAddDialogOpen, setIsTrainingAddDialogOpen] = useState(false);
  const [isTrainingEditDialogOpen, setIsTrainingEditDialogOpen] =
    useState(false);
  const [isTrainingDeleteDialogOpen, setIsTrainingDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TrainingWithRelations | null>(null);
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
        const { data: trainingsRes } = await api.get<TrainingWithRelations[]>(
          "/api/training?includeRequirements=true",
        );
        setTrainings(trainingsRes);
        setIsLoading(false);

        setTrainings((prev) =>
          prev.map((training) => ({
            ...training,
          })),
        );
      } catch (err) {
        console.error("Error fetching data:", err);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditTraining = (record: TrainingWithRelations) => {
    setSelectedRecord(record);
    setIsTrainingEditDialogOpen(true);
  };

  const handleDeleteTraining = (record: TrainingWithRelations) => {
    setSelectedRecord(record);
    setIsTrainingDeleteDialogOpen(true);
  };

  const uniqueCategories = useMemo(
    () => Array.from(new Set(trainings.map((t) => t.category))).sort(),
    [trainings],
  );

  const columns = useMemo<ColumnDef<TrainingWithRelations>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Training Title" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
      },
      {
        accessorKey: "category",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Category" />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.category}</Badge>
        ),
        filterFn: (row, columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true;
          return row.getValue(columnId) === filterValue;
        },
        enableGlobalFilter: true,
      },
      {
        id: "requirements",
        header: "Requirements",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <RequirementsCell training={row.original} />,
      },
      {
        id: "trainingRecords",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Training Records" />
        ),
        accessorFn: (row) => row._count?.trainingRecords ?? 0,
        cell: ({ getValue }) => {
          const count = getValue() as number;
          return `${count} ${count === 1 ? "record" : "records"}`;
        },
        enableGlobalFilter: false,
      },
      {
        id: "exemptions",
        header: "Exemptions",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <ExemptionsCell training={row.original} />,
      },
      {
        id: "compliance",
        header: "Compliance",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: () => <span className="text-muted-foreground">TBD</span>,
      },
      {
        accessorKey: "isActive",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Status" />
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.isActive ? "default" : "secondary"}
            className={
              row.original.isActive
                ? "bg-green-100 text-green-800 hover:bg-green-200"
                : "bg-red-100 text-red-800 hover:bg-red-200"
            }
          >
            {row.original.isActive ? "Active" : "Inactive"}
          </Badge>
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
          const recordCount = row.original._count?.trainingRecords || 0;
          return (
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditTraining(row.original)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteTraining(row.original)}
                disabled={recordCount > 0}
                title={
                  recordCount > 0
                    ? "Cannot delete training course with existing training records"
                    : "Delete training course"
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
    data: trainings,
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
  const categoryFilterValue =
    (table.getColumn("category")?.getFilterValue() as string) ?? "all";

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Training Management</CardTitle>
              <CardDescription>
                Manage training courses and view training records. Showing{" "}
                {table.getFilteredRowModel().rows.length} of {trainings.length}{" "}
                training course
                {trainings.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button onClick={() => setIsTrainingAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Training Course
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or category..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={categoryFilterValue}
              onValueChange={(value) => {
                table
                  .getColumn("category")
                  ?.setFilterValue(value === "all" ? undefined : value);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {uniqueCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground">Loading...</span>
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
                        ? "No training courses match your filters"
                        : "No training courses found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
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

      <NewTrainingDialog
        isOpen={isTrainingAddDialogOpen}
        onOpenChange={setIsTrainingAddDialogOpen}
        onTrainingCreated={(training) => {
          const withDefaults = (
            t: TrainingWithRelations,
          ): TrainingWithRelations => ({
            requirements: [],
            trainingExemptions: [],
            _count: { trainingRecords: 0 },
            ...t,
          });
          if (Array.isArray(training)) {
            setTrainings((prev) => [...prev, ...training.map(withDefaults)]);
          } else {
            setTrainings((prev) => [...prev, withDefaults(training)]);
          }
        }}
      />

      <EditTrainingDialog
        open={isTrainingEditDialogOpen}
        onOpenChange={setIsTrainingEditDialogOpen}
        training={selectedRecord}
        onTrainingUpdated={(result) => {
          if (Array.isArray(result)) {
            // non-SOP → SOP: first item updates existing, second is new practical
            const [taskSheet, practical] = result;
            setTrainings((prev) => [
              ...prev.map((t) =>
                t.id === taskSheet.id ? { ...t, ...taskSheet } : t,
              ),
              {
                requirements: [],
                trainingExemptions: [],
                _count: { trainingRecords: 0 },
                ...practical,
              },
            ]);
          } else {
            // Single training update — may be SOP → non-SOP (sibling deleted on server)
            const wasSop = selectedRecord?.category === "SOP";
            const isNowSop = result.category === "SOP";
            if (wasSop && !isNowSop && selectedRecord?.title) {
              // Derive sibling title so we can remove it from the local list
              const siblingTitle = selectedRecord.title.endsWith(
                " - Task Sheet",
              )
                ? selectedRecord.title.replace(" - Task Sheet", " - Practical")
                : selectedRecord.title.endsWith(" - Practical")
                  ? selectedRecord.title.replace(
                      " - Practical",
                      " - Task Sheet",
                    )
                  : null;
              setTrainings((prev) =>
                prev
                  .map((t) => (t.id === result.id ? { ...t, ...result } : t))
                  .filter(
                    (t) =>
                      siblingTitle === null ||
                      !(t.title === siblingTitle && t.category === "SOP"),
                  ),
              );
            } else {
              setTrainings((prev) =>
                prev.map((t) =>
                  t.id === result.id ? { ...t, ...result } : t,
                ),
              );
            }
          }
        }}
      />

      <DeleteTrainingDialog
        open={isTrainingDeleteDialogOpen}
        onOpenChange={setIsTrainingDeleteDialogOpen}
        training={selectedRecord}
        onTrainingDeleted={(deleted) => {
          const deletedIds = new Set(deleted.map((t) => t.id));
          setTrainings((prev) =>
            prev.filter((training) => !deletedIds.has(training.id)),
          );
        }}
      />
    </div>
  );
};

export default TrainingDirectory;
