"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddLocationDialog } from "@/components/dialogs/location/add-location-dialog";
import { useEffect, useState } from "react";
import { Location } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { EditLocationDialog } from "@/components/dialogs/location/edit-location-dialog";
import { DeleteLocationDialog } from "@/components/dialogs/location/delete-location-dialog";

// Extended type to include employee count
interface LocationWithCount extends Location {
  _count?: {
    employees: number;
  };
}

const locationsDirectory = () => {
  const [locations, setLocations] = useState<LocationWithCount[]>([]);
  const [isLocationAddDialogOpen, setIsLocationAddDialogOpen] = useState(false);
  const [isLocationEditDialogOpen, setIsLocationEditDialogOpen] =
    useState(false);
  const [isLocationDeleteDialogOpen, setIsLocationDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<LocationWithCount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: locationsRes } =
          await api.get<LocationWithCount[]>("/api/locations");
        setLocations(locationsRes);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditLocation = (record: LocationWithCount) => {
    setSelectedRecord(record);
    setIsLocationEditDialogOpen(true);
  };

  const handleDeleteLocation = (record: LocationWithCount) => {
    setSelectedRecord(record);
    setIsLocationDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Location Management</CardTitle>
              <CardDescription>
                Manage locations and view employee assignments. Showing{" "}
                {locations.length} location
                {locations.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button onClick={() => setIsLocationAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Location
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Location Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Employees Assigned</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="text-center text-muted-foreground"
                  >
                    No locations found
                  </TableCell>
                </TableRow>
              ) : (
                locations.map((record: LocationWithCount) => {
                  const employeeCount = record._count?.employees || 0;
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium">
                        {record.name}
                      </TableCell>
                      <TableCell>{record.state}</TableCell>
                      <TableCell>
                        {employeeCount}{" "}
                        {employeeCount === 1 ? "employee" : "employees"}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditLocation(record)}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteLocation(record)}
                            disabled={employeeCount > 0}
                            title={
                              employeeCount > 0
                                ? "Cannot delete location with assigned employees"
                                : "Delete location"
                            }
                          >
                            <Trash className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Dialogs */}
      <AddLocationDialog
        open={isLocationAddDialogOpen}
        onOpenChange={setIsLocationAddDialogOpen}
        onLocationAdded={(dept) => {
          setLocations([...locations, dept]);
        }}
      />

      <EditLocationDialog
        open={isLocationEditDialogOpen}
        onOpenChange={setIsLocationEditDialogOpen}
        location={selectedRecord}
        onLocationUpdated={(updatedDept) => {
          setLocations((prev) =>
            prev.map((dept) =>
              dept.id === updatedDept.id ? updatedDept : dept,
            ),
          );
        }}
      />

      <DeleteLocationDialog
        open={isLocationDeleteDialogOpen}
        onOpenChange={setIsLocationDeleteDialogOpen}
        location={selectedRecord}
        onLocationDeleted={(deletedDept) => {
          setLocations((prev) =>
            prev.filter((dept) => dept.id !== deletedDept.id),
          );
        }}
      />
    </div>
  );
};

export default locationsDirectory;
