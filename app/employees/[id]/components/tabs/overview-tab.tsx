// may need to add more info here depending if personal information should be included. Could also be fetched from external data source?
"use client";
import { useEmployee } from "../employee-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Calendar,
  MapPin,
  Briefcase,
  NotepadText,
  GraduationCap,
} from "lucide-react";
import { format } from "date-fns";
import NotesEditor from "@/components/notes-editor";

export function OverviewTab() {
  const { employee, updateEmployee } = useEmployee();

  if (!employee) return null;

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return format(new Date(date), "PP");
  };
  const handleNotesUpdate = (newNotes: string) => {
    // Update the employee in your context/state
    // This ensures the UI stays in sync after the API call
    updateEmployee?.({ ...employee, notes: newNotes });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Title</span>
              <span className="ml-auto">{employee.title}</span>
            </div>

            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Department</span>
              <span className="ml-auto">{employee.department.name}</span>
            </div>

            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Location</span>
              <span className="ml-auto">{employee.location.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">USI</span>
              <span className="ml-auto">{employee.usi}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge
                variant={employee.isActive ? "default" : "secondary"}
                className="ml-auto"
              >
                {employee.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Start Date</span>
              <span className="ml-auto">{formatDate(employee.startDate)}</span>
            </div>

            {employee.finishDate && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Finish Date
                </span>
                <span className="ml-auto">
                  {formatDate(employee.finishDate)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <NotesEditor
        employeeId={employee.id}
        notes={employee.notes}
        onNotesUpdate={handleNotesUpdate}
      />
    </div>
  );
}
