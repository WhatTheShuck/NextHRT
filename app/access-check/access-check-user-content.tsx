"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AccessorInfo, EmployeeAccessInfo } from "@/lib/services/accessCheckService";
import api from "@/lib/axios";

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

export function AccessCheckUserContent({ userId }: { userId: string }) {
  const [accessInfo, setAccessInfo] = useState<(EmployeeAccessInfo & { linked: boolean }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<EmployeeAccessInfo & { linked: boolean }>("/api/access-check")
      .then((r) => setAccessInfo(r.data))
      .catch(() => setError("Failed to load access information"))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Who Can See My Data</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Who Can See My Data</h1>
        <div className="text-destructive bg-destructive/10 rounded-lg p-4">{error}</div>
      </div>
    );
  }

  if (!accessInfo?.linked) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-4">Who Can See My Data</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Your account is not linked to an employee record.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const admins = accessInfo.accessors.filter((a) => a.accessReason === "Admin");
  const managers = accessInfo.accessors.filter((a) => a.accessReason === "DepartmentManager");
  const self = accessInfo.accessors.filter((a) => a.accessReason === "Self");

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Who Can See My Data</h1>
        <p className="text-muted-foreground mt-1">
          The following users have access to your employee record &mdash;{" "}
          <span className="font-medium text-foreground">
            {accessInfo.firstName} {accessInfo.lastName}
          </span>
          {" "}({accessInfo.department}, {accessInfo.location})
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AccessorCard title="Admins" accessors={admins} />
        <AccessorCard title="Department Managers" accessors={managers} />
        <AccessorCard title="Self (your account)" accessors={self} />
      </div>

      {admins.length === 0 && managers.length === 0 && self.length === 0 && (
        <p className="text-muted-foreground">No users currently have access to your record.</p>
      )}
    </div>
  );
}
