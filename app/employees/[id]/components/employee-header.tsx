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
import { EmployeeEditForm } from "./employee-edit-form";

export function EmployeeHeader() {
  const { employee } = useEmployee();

  if (!employee) return null;

  return (
    <div className="border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              {" "}
              {/* Could potentially grab avatar from domain at some point? Also just kinda gives UX cues that this is an employee*/}
              <AvatarFallback className="bg-muted">
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-semibold">
                {employee.firstName} {employee.lastName}
              </h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>{employee.Title}</span>
                <span>•</span>
                <span>{employee.WorkAreaID}</span>
              </div>
            </div>
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Edit Profile</SheetTitle>
              </SheetHeader>
              <EmployeeEditForm />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}
