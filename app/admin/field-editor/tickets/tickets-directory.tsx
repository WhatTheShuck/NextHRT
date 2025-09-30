"use client";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash, MapPin, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NewTicketDialog } from "@/components/dialogs/tickets/add-ticket-dialog";
import { useEffect, useState } from "react";
import { Ticket } from "@/generated/prisma_client";
import api from "@/lib/axios";
import { EditTicketDialog } from "@/components/dialogs/tickets/edit-ticket-dialog";
import { DeleteTicketDialog } from "@/components/dialogs/tickets/delete-ticket-dialog";
import { TicketWithRelations } from "@/lib/types";

const TicketsDirectory = () => {
  const [tickets, setTickets] = useState<TicketWithRelations[]>([]);
  const [isTicketAddDialogOpen, setIsTicketAddDialogOpen] = useState(false);
  const [isTicketEditDialogOpen, setIsTicketEditDialogOpen] = useState(false);
  const [isTicketDeleteDialogOpen, setIsTicketDeleteDialogOpen] =
    useState(false);
  const [selectedRecord, setSelectedRecord] =
    useState<TicketWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Update API call to include requirements and exemptions
        const { data: ticketsRes } = await api.get<TicketWithRelations[]>(
          "/api/tickets?includeRequirements=true&includeExemptions=true",
        );
        setTickets(ticketsRes);
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleEditTicket = (record: TicketWithRelations) => {
    setSelectedRecord(record);
    setIsTicketEditDialogOpen(true);
  };

  const handleDeleteTicket = (record: TicketWithRelations) => {
    setSelectedRecord(record);
    setIsTicketDeleteDialogOpen(true);
  };

  const RequirementsCell = ({ ticket }: { ticket: TicketWithRelations }) => {
    const requirementCount = ticket.requirements?.length || 0;

    if (requirementCount === 0) {
      return <span className="text-muted-foreground">No requirements</span>;
    }

    const requirementText = ticket.requirements
      ?.map(
        (req) =>
          `${req.department?.name} @ ${req.location?.name}, ${req.location?.state}`,
      )
      .join("\n");

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-help">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {requirementCount} requirement
                {requirementCount !== 1 ? "s" : ""}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="whitespace-pre-line text-sm">
              <strong>Required for:</strong>
              <br />
              {requirementText}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const ExemptionsCell = ({ ticket }: { ticket: TicketWithRelations }) => {
    const activeExemptions =
      ticket.ticketExemptions?.filter((e) => e.status === "Active") || [];
    const exemptionCount = activeExemptions.length;

    if (exemptionCount === 0) {
      return <span className="text-muted-foreground">None</span>;
    }

    const exemptionText = activeExemptions
      .map((exemption) => {
        const expiryText = exemption.endDate
          ? ` (expires ${new Date(exemption.endDate).toLocaleDateString()})`
          : " (permanent)";
        return `${exemption.employee?.firstName} ${exemption.employee?.lastName}: ${exemption.reason}${expiryText}`;
      })
      .join("\n");

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-help">
              <Users className="h-4 w-4 text-amber-600" />
              <span className="text-amber-700">
                {exemptionCount} employee{exemptionCount !== 1 ? "s" : ""}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent className="max-w-sm">
            <div className="whitespace-pre-line text-sm">
              <strong>Exempt employees:</strong>
              <br />
              {exemptionText}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
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
            <div className="flex items-center justify-center h-64">
              <span className="text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Requirements</TableHead>
                  <TableHead>Renewal Period</TableHead>
                  <TableHead>Ticket Records</TableHead>
                  <TableHead>Exemptions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
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
                    .map((record: TicketWithRelations) => {
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
                            <RequirementsCell ticket={record} />
                          </TableCell>
                          <TableCell>
                            {record.renewal
                              ? `${record.renewal} year${record.renewal !== 1 ? "s" : ""}`
                              : "No expiry"}
                          </TableCell>
                          <TableCell>
                            {recordCount}{" "}
                            {recordCount === 1 ? "record" : "records"}
                          </TableCell>
                          <TableCell>
                            <ExemptionsCell ticket={record} />
                          </TableCell>
                          <TableCell>
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
