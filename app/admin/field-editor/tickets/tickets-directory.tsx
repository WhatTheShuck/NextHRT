"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, MapPin, Users, Search } from "lucide-react";
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
import { NewTicketDialog } from "@/components/dialogs/tickets/add-ticket-dialog";
import { useEffect, useState, useMemo } from "react";
import api from "@/lib/axios";
import { EditTicketDialog } from "@/components/dialogs/tickets/edit-ticket-dialog";
import { DeleteTicketDialog } from "@/components/dialogs/tickets/delete-ticket-dialog";
import { TicketWithRelations } from "@/lib/types";
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

const RequirementsCell = ({ ticket }: { ticket: TicketWithRelations }) => {
  const requirementCount = ticket.requirements?.length || 0;

  if (requirementCount === 0) {
    return <span className="text-muted-foreground">No requirements</span>;
  }

  const requirementText = ticket.requirements
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

const ExemptionsCell = ({ ticket }: { ticket: TicketWithRelations }) => {
  const activeExemptions =
    ticket.ticketExemptions?.filter((e) => e.status === "Active") || [];
  const exemptionCount = activeExemptions.length;

  if (exemptionCount === 0) {
    return <span className="text-muted-foreground">None</span>;
  }

  const exemptionText = activeExemptions
    .map((exemption) => {
      const expiryText = exemption.endDate
        ? ` (expires ${new Date(exemption.endDate).toLocaleDateString()})`
        : " (permanent)";
      return `${exemption.employee?.legalFirstName} ${exemption.employee?.legalLastName}: ${exemption.reason}${expiryText}`;
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

const TicketsDirectory = () => {
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [isTicketAddDialogOpen, setIsTicketAddDialogOpen] = useState(false);
  const [isTicketEditDialogOpen, setIsTicketEditDialogOpen] = useState(false);
  const [isTicketDeleteDialogOpen, setIsTicketDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TicketWithRelations | null>(null);
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
        const { data: ticketsRes } = await api.get<TicketWithRelations[]>(
          "/api/tickets?includeRequirements=true&includeExemptions=true",
        );
        setTickets(ticketsRes);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditTicket = (record: TicketWithRelations) => {
    setSelectedRecord(record);
    setIsTicketEditDialogOpen(true);
  };

  const handleDeleteTicket = (record: TicketWithRelations) => {
    setSelectedRecord(record);
    setIsTicketDeleteDialogOpen(true);
  };

  const columns = useMemo<ColumnDef<TicketWithRelations>[]>(
    () => [
      {
        accessorKey: "ticketName",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Ticket Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.ticketName}</span>
        ),
      },
      {
        accessorKey: "ticketCode",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Code" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.ticketCode}</span>
        ),
      },
      {
        id: "requirements",
        header: "Requirements",
        enableSorting: false,
        enableGlobalFilter: false,
        cell: ({ row }) => <RequirementsCell ticket={row.original} />,
      },
      {
        id: "renewal",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Renewal Period" />
        ),
        accessorFn: (row) => row.renewal ?? null,
        cell: ({ row }) =>
          row.original.renewal
            ? `${row.original.renewal} year${row.original.renewal !== 1 ? "s" : ""}`
            : "No expiry",
        enableGlobalFilter: false,
      },
      {
        id: "ticketRecords",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Ticket Records" />
        ),
        accessorFn: (row) => row._count?.ticketRecords ?? 0,
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
        cell: ({ row }) => <ExemptionsCell ticket={row.original} />,
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
          const recordCount = row.original._count?.ticketRecords || 0;
          return (
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEditTicket(row.original)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteTicket(row.original)}
                disabled={recordCount > 0}
                title={
                  recordCount > 0
                    ? "Cannot delete ticket type with existing records"
                    : "Delete ticket type"
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
    data: tickets,
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
    "requirements",
    "renewal",
    "ticketRecords",
    "exemptions",
  ]);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Ticket Management</CardTitle>
              <CardDescription>
                Manage ticket types and view employee assignments. Showing{" "}
                {table.getFilteredRowModel().rows.length} of {tickets.length}{" "}
                ticket type
                {tickets.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button onClick={() => setIsTicketAddDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Add Ticket Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ticket name or code..."
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
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground">Loading...</span>
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
                        ? "No ticket types match your filters"
                        : "No ticket types found"}
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
      <NewTicketDialog
        isOpen={isTicketAddDialogOpen}
        onOpenChange={setIsTicketAddDialogOpen}
        onTicketCreated={(ticket) => {
          setTickets([
            ...tickets,
            {
              requirements: [],
              ticketExemptions: [],
              _count: { ticketRecords: 0 },
              ...ticket,
            },
          ]);
        }}
      />

      <EditTicketDialog
        open={isTicketEditDialogOpen}
        onOpenChange={setIsTicketEditDialogOpen}
        ticket={selectedRecord}
        onTicketUpdated={(updatedTicket) => {
          setTickets((prev) =>
            prev.map((ticket) =>
              ticket.id === updatedTicket.id
                ? { ...ticket, ...updatedTicket }
                : ticket,
            ),
          );
        }}
      />

      <DeleteTicketDialog
        open={isTicketDeleteDialogOpen}
        onOpenChange={setIsTicketDeleteDialogOpen}
        ticket={selectedRecord}
        onTicketDeleted={(deletedTicket) => {
          setTickets((prev) =>
            prev.filter((ticket) => ticket.id !== deletedTicket.id),
          );
        }}
      />
    </div>
  );
};

export default TicketsDirectory;
