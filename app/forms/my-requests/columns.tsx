"use client";

import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export interface MyRequest {
  id: number;
  createdAt: string;
  employeeId: number;
  employee: { id: number; legalFirstName: string; legalLastName: string };
  training: { id: number; title: string } | null;
  trainingCourseRequest: { id: number; name: string } | null;
  approvalRequest: {
    id: number;
    status: string;
    currentStage: string;
    createdAt: string;
    submittedByUserId: string;
    submittedByUser: { id: string; name: string | null };
  };
}

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Approved") return "default";
  if (status === "Rejected") return "destructive";
  if (status === "Cancelled") return "outline";
  return "secondary"; // Pending
}

function stageLabel(stage: string): string {
  if (stage === "DepartmentManager") return "Dept. Manager";
  if (stage === "HRManager") return "HR Manager";
  return stage; // "Admin" falls through — the Prisma enum value is literally "Admin" per schema
}

export const columns: ColumnDef<MyRequest>[] = [
  {
    id: "training",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Training <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (row) =>
      row.training?.title ?? row.trainingCourseRequest?.name ?? "",
    cell: ({ row }) => {
      const name =
        row.original.training?.title ??
        row.original.trainingCourseRequest?.name ??
        "—";
      const isPendingCourse =
        !row.original.training && !!row.original.trainingCourseRequest;
      return (
        <div className="flex items-center gap-2">
          <span>{name}</span>
          {isPendingCourse && (
            <Badge variant="outline" className="text-xs">
              pending course
            </Badge>
          )}
        </div>
      );
    },
    meta: { headerText: "Training" },
  },
  {
    id: "for",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        For <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (row) =>
      `${row.employee.legalFirstName} ${row.employee.legalLastName}`,
    cell: ({ getValue }) => getValue<string>(),
    meta: { headerText: "For" },
  },
  {
    id: "submittedBy",
    header: "Submitted By",
    accessorFn: (row) => row.approvalRequest.submittedByUser.name ?? "—",
    cell: ({ getValue }) => getValue<string>(),
    meta: { headerText: "Submitted By" },
  },
  {
    id: "date",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Date <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    accessorFn: (row) => row.createdAt,
    cell: ({ getValue }) =>
      new Date(getValue<string>()).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    meta: { headerText: "Date" },
  },
  {
    id: "status",
    header: "Status",
    accessorFn: (row) => row.approvalRequest.status,
    cell: ({ getValue }) => {
      const status = getValue<string>();
      return <Badge variant={statusBadgeVariant(status)}>{status}</Badge>;
    },
    meta: { headerText: "Status" },
  },
  {
    id: "stage",
    header: "Stage",
    accessorFn: (row) => {
      const { status, currentStage } = row.approvalRequest;
      if (status === "Pending") return stageLabel(currentStage);
      if (status === "Approved") return "Completed";
      return status;
    },
    cell: ({ row }) => {
      const { status, currentStage } = row.original.approvalRequest;
      if (status === "Pending") return <span>{stageLabel(currentStage)}</span>;
      if (status === "Approved") return <span className="text-muted-foreground">Completed</span>;
      return <span className="text-muted-foreground">{status}</span>;
    },
    meta: { headerText: "Stage" },
  },
  {
    id: "view",
    header: "",
    cell: ({ row }) => (
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/forms/training-request/${row.original.id}`}>
          <ExternalLink className="h-4 w-4" />
        </Link>
      </Button>
    ),
    enableSorting: false,
  },
];
