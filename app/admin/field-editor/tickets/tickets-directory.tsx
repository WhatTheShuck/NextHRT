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
import { NewTicketDialog } from "@/components/dialogs/tickets/add-ticket-dialog";
import { useEffect, useState } from "react";
import { Ticket } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { EditTicketDialog } from "@/components/dialogs/tickets/edit-ticket-dialog";
import { DeleteTicketDialog } from "@/components/dialogs/tickets/delete-ticket-dialog";

// Extended type to include ticket record count
interface TicketWithCount extends Ticket {
  _count?: {
    ticketRecords: number;
  };
}

const TicketsDirectory = () => {
  const [tickets, setTickets] = useState<TicketWithCount[]>([]);
  const [isTicketAddDialogOpen, setIsTicketAddDialogOpen] = useState(false);
  const [isTicketEditDialogOpen, setIsTicketEditDialogOpen] = useState(false);
  const [isTicketDeleteDialogOpen, setIsTicketDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TicketWithCount | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: ticketsRes } =
          await api.get<TicketWithCount[]>("/api/tickets");
        setTickets(ticketsRes);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditTicket = (record: TicketWithCount) => {
    setSelectedRecord(record);
    setIsTicketEditDialogOpen(true);
  };

  const handleDeleteTicket = (record: TicketWithCount) => {
    setSelectedRecord(record);
    setIsTicketDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Ticket Management</CardTitle>
              <CardDescription>
                Manage ticket types and view employee assignments. Showing{" "}
                {tickets.length} ticket type
                {tickets.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <Button onClick={() => setIsTicketAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Ticket Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              Loading tickets...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Renewal Period</TableHead>
                  <TableHead>Employees with Ticket</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground"
                    >
                      No ticket types found
                    </TableCell>
                  </TableRow>
                ) : (
                  tickets
                    .sort((a, b) =>
                      a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1,
                    )
                    .map((record: TicketWithCount) => {
                      const recordCount = record._count?.ticketRecords || 0;
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {record.ticketName}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {record.ticketCode}
                          </TableCell>
                          <TableCell>
                            {record.renewal
                              ? `${record.renewal} year${record.renewal !== 1 ? "s" : ""}`
                              : "No expiry"}
                          </TableCell>
                          <TableCell>
                            {recordCount}{" "}
                            {recordCount === 1 ? "employee" : "employees"}
                          </TableCell>
                          <TableCell>
                            {" "}
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                record.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {record.isActive ? "Active" : "Inactive"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditTicket(record)}
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteTicket(record)}
                                disabled={recordCount > 0}
                                title={
                                  recordCount > 0
                                    ? "Cannot delete ticket type with existing records"
                                    : "Delete ticket type"
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
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <NewTicketDialog
        isOpen={isTicketAddDialogOpen}
        onOpenChange={setIsTicketAddDialogOpen}
        onTicketCreated={(ticket) => {
          setTickets([...tickets, ticket]);
        }}
      />

      <EditTicketDialog
        open={isTicketEditDialogOpen}
        onOpenChange={setIsTicketEditDialogOpen}
        ticket={selectedRecord}
        onTicketUpdated={(updatedTicket) => {
          setTickets((prev) =>
            prev.map((ticket) =>
              ticket.id === updatedTicket.id ? updatedTicket : ticket,
            ),
          );
        }}
      />

      <DeleteTicketDialog
        open={isTicketDeleteDialogOpen}
        onOpenChange={setIsTicketDeleteDialogOpen}
        ticket={selectedRecord}
        onTicketDeleted={(deletedTicket) => {
          setTickets((prev) =>
            prev.filter((ticket) => ticket.id !== deletedTicket.id),
          );
        }}
      />
    </div>
  );
};

export default TicketsDirectory;
