"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UserRoleManagement } from "./user-role-management";
import { UserEmployeeMapping } from "./user-employee-mapping";

export function PermissionPageContent() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="roles">User Roles</TabsTrigger>
          <TabsTrigger value="mapping">User-Employee Mapping</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Manage User Roles</CardTitle>
              <CardDescription>
                Assign roles to users to control their access permissions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserRoleManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping">
          <Card>
            <CardHeader>
              <CardTitle>User-Employee Mapping</CardTitle>
              <CardDescription>
                Link user accounts to employee records.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UserEmployeeMapping />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
