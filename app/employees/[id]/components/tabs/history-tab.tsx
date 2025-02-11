// History of edits made to the employee. Likely a table with information such as what the edit was, who made it and what date it was edited. Probably only contain the edits of personal information about the employee
"use client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export function HistoryTab() {
  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Edit History</CardTitle>
            <CardDescription>
              History is not currently supported in the API yet
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column Edited</TableHead>
              <TableHead>Previous Record</TableHead>
              <TableHead>New Record</TableHead>
              <TableHead>Edited By</TableHead>
              <TableHead>Edit Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody></TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
