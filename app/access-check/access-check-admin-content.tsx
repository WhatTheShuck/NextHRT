"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmployeeCombobox } from "@/components/combobox/employee-combobox";
import { NavigationCard } from "@/components/navigation-card";
import { EmployeeWithRelations } from "@/lib/types";
import {
  EmployeeAccessInfo,
  AccessorInfo,
} from "@/lib/services/accessCheckService";
import api from "@/lib/axios";
import {
  Archive,
  Building2,
  MapPin,
  Users,
  Shield,
  User,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function AccessorBadge({ reason }: { reason: AccessorInfo["accessReason"] }) {
  if (reason === "Admin")
    return <Badge className="bg-blue-500 text-white shrink-0">Admin</Badge>;
  if (reason === "DepartmentManager")
    return (
      <Badge className="bg-orange-500 text-white shrink-0">Dept Manager</Badge>
    );
  return <Badge variant="secondary" className="shrink-0">Self</Badge>;
}

interface AccessorCardProps {
  title: string;
  accessors: AccessorInfo[];
  icon: React.ElementType;
  emptyLabel: string;
}

function AccessorCard({
  title,
  accessors,
  icon: Icon,
  emptyLabel,
}: AccessorCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {accessors.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-3">
            {accessors.map((a) => (
              <li key={a.userId} className="flex items-start gap-3 text-sm">
                <AccessorBadge reason={a.accessReason} />
                <div className="min-w-0">
                  <p className="font-medium truncate">{a.name ?? "—"}</p>
                  {a.email && (
                    <p className="text-xs text-muted-foreground truncate">
                      {a.email}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function AccessCheckAdminContent() {
  const [allEmployees, setAllEmployees] = useState<EmployeeWithRelations[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null,
  );
  const [accessInfo, setAccessInfo] = useState<EmployeeAccessInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingEmployees, setFetchingEmployees] = useState(true);
  const [includeInactive, setIncludeInactive] = useState(false);

  useEffect(() => {
    api
      .get<EmployeeWithRelations[]>("/api/employees")
      .then((r) => setAllEmployees(r.data))
      .catch(() => setError("Failed to load employees"))
      .finally(() => setFetchingEmployees(false));
  }, []);

  const filteredEmployees = useMemo(
    () =>
      includeInactive
        ? allEmployees
        : allEmployees.filter((e) => e.isActive),
    [allEmployees, includeInactive],
  );

  const handleInactiveToggle = (checked: boolean) => {
    setIncludeInactive(checked);
    if (!checked && selectedEmployeeId) {
      const selected = allEmployees.find(
        (e) => e.id.toString() === selectedEmployeeId,
      );
      if (selected && !selected.isActive) {
        setSelectedEmployeeId(null);
        setAccessInfo(null);
      }
    }
  };

  const handleSelect = async (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setAccessInfo(null);
    setError(null);
    setLoading(true);
    try {
      const r = await api.get<EmployeeAccessInfo>(
        `/api/access-check?employeeId=${employeeId}`,
      );
      setAccessInfo(r.data);
    } catch {
      setError("Failed to load access information");
    } finally {
      setLoading(false);
    }
  };

  const admins =
    accessInfo?.accessors.filter((a) => a.accessReason === "Admin") ?? [];
  const managers =
    accessInfo?.accessors.filter(
      (a) => a.accessReason === "DepartmentManager",
    ) ?? [];
  const self =
    accessInfo?.accessors.filter((a) => a.accessReason === "Self") ?? [];

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Access Check</h1>
        <p className="text-muted-foreground mt-1">
          See who has access to a specific employee&apos;s data
        </p>
      </div>

      {/* Search card */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <EmployeeCombobox
                employees={filteredEmployees}
                onSelect={handleSelect}
                selectedEmployeeId={selectedEmployeeId}
                disabled={fetchingEmployees}
                placeholder={
                  fetchingEmployees
                    ? "Loading employees..."
                    : "Search and select an employee..."
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="include-inactive"
                checked={includeInactive}
                onCheckedChange={handleInactiveToggle}
              />
              <Label
                htmlFor="include-inactive"
                className="flex items-center gap-2 cursor-pointer"
              >
                <Archive className="h-4 w-4 text-muted-foreground" />
                Include inactive
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading state */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-3">
                <Skeleton className="h-5 w-24" />
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="flex items-start gap-3">
                      <Skeleton className="h-5 w-20 rounded-full shrink-0" />
                      <div className="space-y-1 flex-1">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="text-destructive bg-destructive/10 rounded-lg p-4">
          {error}
        </div>
      )}

      {/* Access result */}
      {accessInfo && !loading && (
        <div className="space-y-4">
          {/* Employee info summary */}
          <div className="rounded-lg bg-muted/50 border p-4 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-semibold text-base">
                {accessInfo.legalFirstName} {accessInfo.legalLastName}
              </span>
              <Badge variant="outline">{accessInfo.department}</Badge>
              <Badge variant="outline">{accessInfo.location}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">
                {accessInfo.accessorCount}
              </span>{" "}
              user{accessInfo.accessorCount !== 1 ? "s" : ""} currently have
              access to this employee record.
            </p>
          </div>

          {/* Accessor cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AccessorCard
              title="Admins"
              accessors={admins}
              icon={Shield}
              emptyLabel="No admins"
            />
            <AccessorCard
              title="Department Managers"
              accessors={managers}
              icon={Building2}
              emptyLabel="No department managers"
            />
            <AccessorCard
              title="Self (linked user)"
              accessors={self}
              icon={User}
              emptyLabel="No linked user account"
            />
          </div>
        </div>
      )}

      {/* Access reports section */}
      <div className="space-y-3 pt-2 border-t">
        <div>
          <h2 className="text-lg font-semibold">Access Reports</h2>
          <p className="text-sm text-muted-foreground">
            Generate a full access report across all employees
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NavigationCard
            title="All Staff"
            description="View accessor information for every employee"
            icon={Users}
            href="/reports/access/all"
            minimumAllowedPermission="user:impersonate"
          />
          <NavigationCard
            title="By Department"
            description="Filter employees by department to view their accessors"
            icon={Building2}
            href="/reports/access/department"
            minimumAllowedPermission="user:impersonate"
          />
          <NavigationCard
            title="By Location"
            description="Filter employees by location to view their accessors"
            icon={MapPin}
            href="/reports/access/location"
            minimumAllowedPermission="user:impersonate"
          />
        </div>
      </div>
    </div>
  );
}
