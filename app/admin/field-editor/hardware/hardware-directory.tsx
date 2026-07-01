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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { useEffect, useState, useMemo } from "react";
import { useMediaQuery } from "usehooks-ts";
import { cn } from "@/lib/utils";
import { HardwareItem } from "@/generated/prisma_client/client";
import api from "@/lib/axios";
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

interface HardwareFormValues {
  name: string;
  payloadTemplate: string;
  isActive: boolean;
}

interface HardwareFormProps {
  initialValues: HardwareFormValues;
  submitLabel: string;
  onSubmit: (values: HardwareFormValues) => Promise<void>;
  onClose: () => void;
  className?: string;
}

function HardwareForm({
  initialValues,
  submitLabel,
  onSubmit,
  onClose,
  className,
}: HardwareFormProps) {
  const [name, setName] = useState(initialValues.name);
  const [payloadTemplate, setPayloadTemplate] = useState(
    initialValues.payloadTemplate,
  );
  const [isActive, setIsActive] = useState(initialValues.isActive);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert("Please enter a hardware item name");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({ name: name.trim(), payloadTemplate, isActive });
      onClose();
    } catch (err: any) {
      console.error("Error saving hardware item:", err);
      alert(err.response?.data?.error || "Failed to save hardware item");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="hardwareName">Name</Label>
        <Input
          id="hardwareName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Laptop"
          disabled={isSaving}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="hardwarePayload">Payload Template</Label>
        <Textarea
          id="hardwarePayload"
          value={payloadTemplate}
          onChange={(e) => setPayloadTemplate(e.target.value)}
          placeholder='e.g., {"type":"laptop","item":"Laptop"}'
          rows={4}
          disabled={isSaving}
        />
        <p className="text-xs text-muted-foreground">
          JSON/template sent to the hardware-request platform.
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="hardwareActive"
          checked={isActive}
          onCheckedChange={(checked) => setIsActive(checked === true)}
          disabled={isSaving}
        />
        <Label htmlFor="hardwareActive">Active</Label>
      </div>
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button type="button" onClick={handleSubmit} disabled={isSaving}>
          {isSaving ? "Saving..." : submitLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface HardwareFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  initialValues: HardwareFormValues;
  submitLabel: string;
  onSubmit: (values: HardwareFormValues) => Promise<void>;
}

function HardwareFormDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValues,
  submitLabel,
  onSubmit,
}: HardwareFormDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <HardwareForm
              initialValues={initialValues}
              submitLabel={submitLabel}
              onSubmit={onSubmit}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <HardwareForm
          className="px-4 overflow-y-auto"
          initialValues={initialValues}
          submitLabel={submitLabel}
          onSubmit={onSubmit}
          onClose={handleClose}
        />
      </DrawerContent>
    </Drawer>
  );
}

interface DeleteHardwareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: HardwareItem | null;
  onConfirm: () => Promise<void>;
}

function DeleteHardwareDialog({
  open,
  onOpenChange,
  item,
  onConfirm,
}: DeleteHardwareDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Error deleting hardware item:", err);
      alert(err.response?.data?.error || "Failed to delete hardware item");
    } finally {
      setIsDeleting(false);
    }
  };

  const title = "Delete Hardware Item";
  const description = item
    ? `Are you sure you want to delete "${item.name}"? This cannot be undone.`
    : "";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const HardwareDirectory = () => {
  const [items, setItems] = useState<HardwareItem[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<HardwareItem | null>(
    null,
  );
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
        const { data } = await api.get<HardwareItem[]>("/api/hardware");
        setItems(data);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEdit = (record: HardwareItem) => {
    setSelectedRecord(record);
    setIsEditOpen(true);
  };

  const handleDelete = (record: HardwareItem) => {
    setSelectedRecord(record);
    setIsDeleteOpen(true);
  };

  const columns = useMemo<ColumnDef<HardwareItem>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "payloadTemplate",
        header: ({ column }) => (
          <SortableColumnHeader column={column} label="Payload Template" />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground line-clamp-1">
            {row.original.payloadTemplate || "—"}
          </span>
        ),
        enableGlobalFilter: true,
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
        cell: ({ row }) => (
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
            >
              <Trash className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const table = useReactTable({
    data: items,
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

  const mobileHiddenCols = new Set(["payloadTemplate"]);

  const handleCreate = async (values: HardwareFormValues) => {
    const { data } = await api.post<HardwareItem>("/api/hardware", values);
    setItems((prev) => [...prev, data]);
  };

  const handleUpdate = async (values: HardwareFormValues) => {
    if (!selectedRecord) return;
    const { data } = await api.put<HardwareItem>(
      `/api/hardware/${selectedRecord.id}`,
      values,
    );
    setItems((prev) => prev.map((i) => (i.id === data.id ? data : i)));
  };

  const handleConfirmDelete = async () => {
    if (!selectedRecord) return;
    await api.delete(`/api/hardware/${selectedRecord.id}`);
    setItems((prev) => prev.filter((i) => i.id !== selectedRecord.id));
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Hardware Catalogue</CardTitle>
              <CardDescription>
                Manage hardware items available for onboarding requests. Showing{" "}
                {table.getFilteredRowModel().rows.length} of {items.length} item
                {items.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsAddOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Hardware Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search hardware..."
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
              Loading hardware items...
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
                        ? "No hardware items match your filters"
                        : "No hardware items found"}
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

      <HardwareFormDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Add Hardware Item"
        description="Create a new hardware item available for onboarding requests."
        initialValues={{ name: "", payloadTemplate: "", isActive: true }}
        submitLabel="Create Item"
        onSubmit={handleCreate}
      />

      {selectedRecord && (
        <HardwareFormDialog
          key={selectedRecord.id}
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          title="Edit Hardware Item"
          description="Update the details for this hardware item."
          initialValues={{
            name: selectedRecord.name,
            payloadTemplate: selectedRecord.payloadTemplate ?? "",
            isActive: selectedRecord.isActive,
          }}
          submitLabel="Save Changes"
          onSubmit={handleUpdate}
        />
      )}

      <DeleteHardwareDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        item={selectedRecord}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

export default HardwareDirectory;
