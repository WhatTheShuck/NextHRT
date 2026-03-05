"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EmployeeCombobox } from "@/components/combobox/employee-combobox";
import { NavigationCard } from "@/components/navigation-card";
import { EmployeeWithRelations } from "@/lib/types";
import { EmployeeAccessInfo, AccessorInfo } from "@/lib/services/accessCheckService";
import api from "@/lib/axios";
import { Archive, Building2, MapPin, Users } from "lucide-react";

function AccessorBadge({ reason }: { reason: AccessorInfo["accessReason"] }) {
  if (reason === "Admin") return <Badge className="bg-blue-500 text-white">Admin</Badge>;
  if (reason === "DepartmentManager") return <Badge className="bg-orange-500 text-white">Dept Manager</Badge>;
  return <Badge variant="secondary">Self</Badge>;
}

function AccessorCard({ title, accessors }: { title: string; accessors: AccessorInfo[] }) {
  if (accessors.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {accessors.map((a) => (
            <li key={a.userId} className="flex items-center gap-2 text-sm">
              <AccessorBadge reason={a.accessReason} />
              <span className="font-medium">{a.name ?? "—"}</span>
              {a.email && <span className="text-muted-foreground">{a.email}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AccessCheckAdminContent() {
  const [allEmployees, setAllEmployees] = useState<EmployeeWithRelations[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
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
    () => (includeInactive ? allEmployees : allEmployees.filter((e) => e.isActive)),
    [allEmployees, includeInactive],
  );

  const handleInactiveToggle = (checked: boolean) => {
    setIncludeInactive(checked);
    // Clear selection only if the selected employee is inactive and we're hiding inactive
    if (!checked && selectedEmployeeId) {
      const selected = allEmployees.find((e) => e.id.toString() === selectedEmployeeId);
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
      const r = await api.get<EmployeeAccessInfo>(`/api/access-check?employeeId=${employeeId}`);
      setAccessInfo(r.data);
    } catch {
      setError("Failed to load access information");
    } finally {
      setLoading(false);
    }
  };

  const admins = accessInfo?.accessors.filter((a) => a.accessReason === "Admin") ?? [];
  const managers = accessInfo?.accessors.filter((a) => a.accessReason === "DepartmentManager") ?? [];
  const self = accessInfo?.accessors.filter((a) => a.accessReason === "Self") ?? [];

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Access Check</h1>
        <p className="text-muted-foreground mt-1">
          See who has access to a specific employee&apos;s data
        </p>
      </div>

      {/* Employee search */}
      <div className="space-y-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-64">
            <EmployeeCombobox
              employees={filteredEmployees}
              onSelect={handleSelect}
              selectedEmployeeId={selectedEmployeeId}
              disabled={fetchingEmployees}
              placeholder={fetchingEmployees ? "Loading employees..." : "Search and select an employee..."}
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={handleInactiveToggle}
            />
            <Label htmlFor="include-inactive" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              Include inactive employees
            </Label>
          </div>
        </div>
      </div>

      {/* Access result */}
      {loading && <p className="text-muted-foreground">Loading access information...</p>}

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-lg p-4">{error}</div>
      )}

      {accessInfo && !loading && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {accessInfo.firstName} {accessInfo.lastName}
            </span>{" "}
            &mdash; {accessInfo.department} &bull; {accessInfo.location} &bull;{" "}
            <span className="font-medium">{accessInfo.accessorCount}</span> user
            {accessInfo.accessorCount !== 1 ? "s" : ""} with access
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AccessorCard title="Admins" accessors={admins} />
            <AccessorCard title="Department Managers" accessors={managers} />
            <AccessorCard title="Self (linked user)" accessors={self} />
          </div>
          {admins.length === 0 && managers.length === 0 && self.length === 0 && (
            <p className="text-muted-foreground">No users currently have access to this employee.</p>
          )}
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
