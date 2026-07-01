// app/employees/[id]/components/employee-header.tsx
"use client";

import { User, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useEmployee } from "./employee-context";
import { EmployeeEditForm } from "@/components/forms/employee-edit-form";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Skeleton } from "@/components/ui/skeleton";

export function EmployeeHeader() {
  const { employee, isLoading } = useEmployee();
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === "Admin";

  const [isSheetOpen, setIsSheetOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!employee) return null;

  return (
    <div className="border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 shrink-0">
              {/* Could potentially grab avatar from domain at some point? Also just kinda gives UX cues that this is an employee*/}
              <AvatarFallback className="bg-muted">
                <User className="h-7 w-7" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold sm:text-2xl">
                {employee.preferredFirstName || employee.legalFirstName}{" "}
                {employee.preferredLastName || employee.legalLastName}
              </h1>
              {(employee.preferredFirstName || employee.preferredLastName) && (
                <p className="text-xs text-muted-foreground">
                  Legal: {employee.legalFirstName} {employee.legalLastName}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground sm:gap-2">
                <span className="truncate">{employee.title}</span>
                <span>•</span>
                <span className="truncate">{employee.department.name}</span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <SheetTrigger asChild>
                <Button className="shrink-0 w-full sm:w-auto">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Edit Profile</SheetTitle>
                </SheetHeader>
                <EmployeeEditForm onSuccess={() => setIsSheetOpen(false)} />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </div>
  );
}
