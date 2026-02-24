"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Building, MapPin, Calendar, AlertTriangle } from "lucide-react";
import api from "@/lib/axios";
import { UserWithRelations } from "@/lib/types";
import { format } from "date-fns";

interface UserProfileDetailsProps {
  userId: string;
}

const formatDate = (date: Date | null) => {
  if (!date) return "Not set";
  return format(new Date(date), "PP");
};

function getRoleBadgeVariant(
  role: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "Admin":
      return "destructive";
    case "Manager":
      return "default";
    case "Employee":
      return "secondary";
    default:
      return "outline";
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Role & Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-6 w-20" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Employee Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function UserProfileDetails({
  userId,
}: UserProfileDetailsProps) {
  const [userData, setUserData] = useState<UserWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true);
        const response = await api.get(`/api/users/${userId}`);
        setUserData(response.data);
      } catch (err: any) {
        console.error("Error fetching user data:", err);
        setError(err.response?.data?.message || "Failed to load user details");
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchUserData();
    }
  }, [userId]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!userData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>No user data available</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Role & Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge
            variant={getRoleBadgeVariant(userData.role || "No Role")}
            className="text-sm"
          >
            {userData.role || "No Role"}
          </Badge>
        </CardContent>
      </Card>

      {/* Employee Information */}
      {userData.employee && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Employee Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Full Name
                  </label>
                  <p className="text-base font-medium">
                    {userData.employee.firstName} {userData.employee.lastName}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Department
                  </label>
                  <p className="text-base font-medium">
                    {userData.employee.department?.name || "Not specified"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Job Title
                  </label>
                  <p className="text-base">
                    {userData.employee.title || "Not specified"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Start Date
                    </label>
                    <p className="text-base">
                      {formatDate(userData.employee.startDate)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Department
                    </label>
                    <p className="text-base font-medium">
                      {userData.employee.department.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Location
                    </label>
                    <p className="text-base font-medium">
                      {userData.employee.location.name}
                    </p>
                    {userData.employee.location.state && (
                      <p className="text-sm text-muted-foreground">
                        {userData.employee.location.state}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Managed Departments */}
      {userData.managedDepartments &&
        userData.managedDepartments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Managed Departments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {userData.managedDepartments.map((dept) => (
                  <Badge key={dept.id} variant="outline" className="px-3 py-1">
                    {dept.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* No Employee Record */}
      {!userData.employee && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No employee record found. Contact your administrator if this seems
            incorrect.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
