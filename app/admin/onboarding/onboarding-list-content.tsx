"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Inbox, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { OnboardingStatus } from "@/generated/prisma_client/client";

interface OnboardingRequestRow {
  id: number;
  status: OnboardingStatus;
  legalFirstName: string;
  legalLastName: string;
  title: string;
  departmentId: number;
  locationId: number;
  employmentStatus: string;
  employmentType: string;
  startDate: string;
  createdAt: string;
  createdEmployeeId: number | null;
  submittedByUser: { id: string; name: string | null; email: string };
}

function statusBadge(status: OnboardingStatus) {
  const variants: Record<OnboardingStatus, string> = {
    Pending: "bg-yellow-100 text-yellow-800",
    Approved: "bg-green-100 text-green-800",
    Rejected: "bg-red-100 text-red-800",
    Cancelled: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${variants[status]}`}
    >
      {status}
    </span>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return format(new Date(iso), "PP");
}

export function OnboardingListContent() {
  const router = useRouter();
  const [requests, setRequests] = useState<OnboardingRequestRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    api
      .get<OnboardingRequestRow[]>(`/api/onboarding${params}`)
      .then((res) => setRequests(res.data))
      .catch(() => setError("Failed to load onboarding requests."))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  const pendingCount = requests.filter((r) => r.status === "Pending").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Onboarding Requests
              {pendingCount > 0 && statusFilter === "all" && (
                <Badge className="ml-1">{pendingCount} pending</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Review, approve, or reject employee onboarding submissions.
            </CardDescription>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            Loading...
          </p>
        ) : requests.length === 0 ? (
          <p className="text-muted-foreground text-sm py-8 text-center">
            {statusFilter !== "all"
              ? `No ${statusFilter.toLowerCase()} requests.`
              : "No onboarding requests found."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Title</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Emp. Status
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Start Date
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Submitted By
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/admin/onboarding/${r.id}`)
                    }
                  >
                    <TableCell className="font-medium">
                      {r.legalFirstName} {r.legalLastName}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {r.title}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {r.employmentStatus}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {fmt(r.startDate)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">
                      {r.submittedByUser.name ?? r.submittedByUser.email}
                    </TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/onboarding/${r.id}`);
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
