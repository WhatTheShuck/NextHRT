// may need to add more info here depending if personal information should be included. Could also be fetched from external data source?
"use client";

import { useEmployee } from "../employee-context";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, MapPin, Briefcase } from "lucide-react";
import { format } from "date-fns";

export function OverviewTab() {
  const { employee } = useEmployee();

  if (!employee) return null;

  const formatDate = (date: Date | null) => {
    if (!date) return "Not set";
    return format(new Date(date), "PP");
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Employment Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Title</span>
            <span className="ml-auto">{employee.Title}</span>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Department</span>
            <span className="ml-auto">{employee.Department}</span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Location</span>
            <span className="ml-auto">{employee.Location}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Work Area ID</span>
            <span className="ml-auto">{employee.WorkAreaID}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge
              variant={employee.IsActive ? "default" : "secondary"}
              className="ml-auto"
            >
              {employee.IsActive ? "Active" : "Inactive"}
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
            <span className="ml-auto">{formatDate(employee.StartDate)}</span>
          </div>

          {employee.FinishDate && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Finish Date</span>
              <span className="ml-auto">{formatDate(employee.FinishDate)}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Created</span>
            <span className="ml-auto">
              {format(new Date(employee.createdAt), "PP")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Last Updated</span>
            <span className="ml-auto">
              {format(new Date(employee.updatedAt), "PP")}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
