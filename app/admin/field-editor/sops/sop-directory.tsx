"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SortableColumnHeader } from "@/components/sortable-column-header";
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
import {
  AlertTriangle,
  CheckCircle2,
  Edit,
  FileText,
  HelpCircle,
  MapPin,
  Plus,
  Search,
  Trash,
  Users,
} from "lucide-react";
import { AddSopDialog } from "@/components/dialogs/sop/add-sop-dialog";
import { EditSopDialog } from "@/components/dialogs/sop/edit-sop-dialog";
import { DeleteSopDialog } from "@/components/dialogs/sop/delete-sop-dialog";
import { SopSummary } from "@/lib/services/sopService";

/** An SOP is takeable only once it has a revision, a procedure, questions and a trainer. */
const isReady = (sop: SopSummary) => sop.issues.length === 0;

const ContentCell = ({ sop }: { sop: SopSummary }) => {
  if (!sop.currentRevision) {
    return (
      <span className="text-muted-foreground text-sm">No current revision</span>
    );
  }
  const { revisionLabel, effectiveDate, hasDocument, questionCount } =
    sop.currentRevision;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-medium text-sm">{revisionLabel}</span>
        {sop.revisionCount > 1 && (
          <span className="text-xs text-muted-foreground">
            of {sop.revisionCount}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span
          className={
            hasDocument
              ? "flex items-center gap-1 text-muted-foreground"
              : "flex items-center gap-1 text-amber-700"
          }
        >
          <FileText className="h-3.5 w-3.5" />
          {hasDocument ? "Procedure PDF" : "No PDF"}
        </span>
        <span
          className={
            questionCount > 0
              ? "flex items-center gap-1 text-muted-foreground"
              : "flex items-center gap-1 text-amber-700"
          }
        >
          <HelpCircle className="h-3.5 w-3.5" />
          {questionCount} question{questionCount !== 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Effective {new Date(effectiveDate).toLocaleDateString()}
      </p>
    </div>
  );
};

const TrainersCell = ({ sop }: { sop: SopSummary }) => {
  if (sop.trainers.length === 0) {
    return <span className="text-amber-700 text-sm">None</span>;
  }
  const names = sop.trainers
    .map((t) => `${t.name}${t.hasAccount ? "" : " (no login)"}`)
    .join("\n");
  const missingLogins = sop.trainers.filter((t) => !t.hasAccount).length;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>{sop.trainers.length}</span>
            {missingLogins > 0 && (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="whitespace-pre-line text-sm">
            <strong>Designated trainers:</strong>
            <br />
            {names}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const RequirementsCell = ({ sop }: { sop: SopSummary }) => {
  if (sop.requirements.length === 0) {
    return <span className="text-muted-foreground text-sm">No requirements</span>;
  }
  const text = sop.requirements
    .map((req) => `${req.departmentName} @ ${req.locationName}`)
    .join("\n");
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 cursor-help text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span>
              {sop.requirements.length} requirement
              {sop.requirements.length !== 1 ? "s" : ""}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="whitespace-pre-line text-sm">
            <strong>Required for:</strong>
            <br />
            {text}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const ProgressCell = ({ sop }: { sop: SopSummary }) => {
  const { inProgress, awaitingMarking, changesRequested } = sop.assessments;
  return (
    <div className="space-y-1 text-sm">
      {/* Two different facts: reading the procedure, and being signed off on it. */}
      <div className="font-medium">{sop.completions} signed off</div>
      <div className="text-xs text-muted-foreground">
        {sop.acknowledgements} read
      </div>
      <div className="flex flex-wrap gap-1">
        {awaitingMarking > 0 && (
          <Badge variant="secondary" className="text-xs">
            {awaitingMarking} to mark
          </Badge>
        )}
        {changesRequested > 0 && (
          <Badge variant="outline" className="text-xs">
            {changesRequested} returned
          </Badge>
        )}
        {inProgress > 0 && (
          <Badge variant="outline" className="text-xs">
            {inProgress} in progress
          </Badge>
        )}
      </div>
    </div>
  );
};

const ReadinessCell = ({ sop }: { sop: SopSummary }) => {
  if (isReady(sop)) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4" />
        Ready
      </span>
    );
  }
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex items-center gap-1.5 cursor-help text-sm text-amber-700">
            <AlertTriangle className="h-4 w-4" />
            Needs setup
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="whitespace-pre-line text-sm">
            {sop.issues.join("\n")}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const SopDirectory = () => {
  const [sops, setSops] = useState<SopSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "title", desc: false },
  ]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editing, setEditing] = useState<SopSummary | null>(null);
  const [deleting, setDeleting] = useState<SopSummary | null>(null);

  const fetchSops = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get<SopSummary[]>("/api/sops");
      setSops(data);
      setLoadError("");
    } catch {
      setLoadError("Failed to load SOPs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSops();
  }, []);

  const columns = useMemo<ColumnDef<SopSummary>[]>(
    () => [
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="SOP" />
        ),
        cell: ({ row }) => (
          <div className="space-y-1">
            <span className="font-medium">{row.original.title}</span>
            {!row.original.paired && (
              <Badge variant="destructive" className="ml-2 text-xs">
                Not paired
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "content",
        header: "Current Revision",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <ContentCell sop={row.original} />,
      },
      {
        id: "trainers",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Trainers" />
        ),
        accessorFn: (row) => row.trainers.length,
        cell: ({ row }) => <TrainersCell sop={row.original} />,
        enableGlobalFilter: false,
      },
      {
        id: "requirements",
        header: "Requirements",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <RequirementsCell sop={row.original} />,
      },
      {
        id: "progress",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Progress" />
        ),
        accessorFn: (row) => row.completions,
        cell: ({ row }) => <ProgressCell sop={row.original} />,
        enableGlobalFilter: false,
      },
      {
        id: "readiness",
        header: "Setup",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <ReadinessCell sop={row.original} />,
        filterFn: (row, _columnId, filterValue) => {
          if (!filterValue || filterValue === "all") return true;
          return filterValue === "ready"
            ? isReady(row.original)
            : !isReady(row.original);
        },
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
          // Mirrors the server: records and assessments are evidence and block
          // deletion outright.
          const hasEvidence =
            row.original.acknowledgements > 0 ||
            row.original.completions > 0 ||
            row.original.assessments.inProgress > 0 ||
            row.original.assessments.awaitingMarking > 0 ||
            row.original.assessments.changesRequested > 0 ||
            row.original.assessments.passed > 0;
          return (
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(row.original)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleting(row.original)}
                disabled={hasEvidence}
                title={
                  hasEvidence
                    ? "SOPs with training records or assessments cannot be deleted — deactivate instead"
                    : "Delete this SOP"
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
    [],
  );

  const table = useReactTable({
    data: sops,
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
  const readinessFilterValue =
    (table.getColumn("readiness")?.getFilterValue() as string) ?? "all";

  const needsSetupCount = sops.filter((sop) => !isReady(sop)).length;
  const awaitingMarkingCount = sops.reduce(
    (total, sop) => total + sop.assessments.awaitingMarking,
    0,
  );

  const mobileHiddenCols = new Set([
    "content",
    "trainers",
    "requirements",
    "progress",
  ]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Standard Operating Procedures</CardTitle>
              <CardDescription>
                Each SOP is one Task Sheet plus one Practical assessment.
                Showing {table.getFilteredRowModel().rows.length} of{" "}
                {sops.length} SOP{sops.length !== 1 ? "s" : ""}
                {needsSetupCount > 0 && ` · ${needsSetupCount} need setup`}
                {awaitingMarkingCount > 0 && (
                  <>
                    {" · "}
                    <Link href="/sop-reviews" className="underline">
                      {awaitingMarkingCount} awaiting marking
                    </Link>
                  </>
                )}
              </CardDescription>
            </div>
            <Button onClick={() => setIsAddOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add SOP
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 mb-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search SOPs..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={readinessFilterValue}
              onValueChange={(value) =>
                table
                  .getColumn("readiness")
                  ?.setFilterValue(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Setup" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All setup states</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="needs-setup">Needs setup</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilterValue}
              onValueChange={(value) =>
                table
                  .getColumn("isActive")
                  ?.setFilterValue(value === "all" ? undefined : value)
              }
            >
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 border border-red-200 mb-4">
              {loadError}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                          ? "No SOPs match your filters"
                          : "No SOPs yet. Add one to get started."}
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
                                ? "hidden md:table-cell align-top"
                                : "align-top"
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
            </div>
          )}
        </CardContent>
      </Card>

      <AddSopDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSopCreated={fetchSops}
      />

      <EditSopDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            // Content edits (PDF, questions, trainers) save independently of the
            // details form, so always re-read on close.
            fetchSops();
          }
        }}
        sop={editing}
        onSopUpdated={(updated) =>
          setSops((prev) =>
            prev.map((sop) =>
              sop.taskSheetId === updated.taskSheetId ? updated : sop,
            ),
          )
        }
      />

      <DeleteSopDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        sop={deleting}
        onSopDeleted={(taskSheetId) =>
          setSops((prev) => prev.filter((sop) => sop.taskSheetId !== taskSheetId))
        }
      />
    </div>
  );
};

export default SopDirectory;
