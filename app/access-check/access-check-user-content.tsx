"use client";

import React, { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessorInfo, EmployeeAccessInfo } from "@/lib/services/accessCheckService";
import { Shield, Building2, User } from "lucide-react";
import api from "@/lib/axios";

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

export function AccessCheckUserContent({ userId }: { userId: string }) {
  const [accessInfo, setAccessInfo] = useState<
    (EmployeeAccessInfo & { linked: boolean }) | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<EmployeeAccessInfo & { linked: boolean }>("/api/access-check")
      .then((r) => setAccessInfo(r.data))
      .catch(() => setError("Failed to load access information"))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 md:py-8 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Who Can See My Data</h1>
        <p className="text-muted-foreground mt-1">
          The users and roles that currently have access to your employee record.
        </p>
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-16 w-full rounded-lg" />
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

      {error && (
        <div className="text-destructive bg-destructive/10 rounded-lg p-4">
          {error}
        </div>
      )}

      {!loading && !error && !accessInfo?.linked && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Your account is not linked to an employee record. Contact an
              administrator to have your account linked.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && accessInfo?.linked && (
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
              access to your record.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AccessorCard
              title="Admins"
              accessors={accessInfo.accessors.filter(
                (a) => a.accessReason === "Admin",
              )}
              icon={Shield}
              emptyLabel="No admins"
            />
            <AccessorCard
              title="Department Managers"
              accessors={accessInfo.accessors.filter(
                (a) => a.accessReason === "DepartmentManager",
              )}
              icon={Building2}
              emptyLabel="No department managers"
            />
            <AccessorCard
              title="Self (your account)"
              accessors={accessInfo.accessors.filter(
                (a) => a.accessReason === "Self",
              )}
              icon={User}
              emptyLabel="No linked user account"
            />
          </div>
        </div>
      )}
    </div>
  );
}
