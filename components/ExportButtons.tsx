"use client";
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, FileText } from "lucide-react";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { ColumnDef } from "@tanstack/react-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ExportButtonsProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  filename: string;
  title?: string;
  sortedData?: T[];
  isSorted?: boolean;
}

export function ExportButtons<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  title,
  sortedData,
  isSorted,
}: ExportButtonsProps<T>) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState<"excel" | "pdf" | null>(
    null,
  );

  const doExport = (useCurrentSort: boolean, format: "excel" | "pdf") => {
    const exportData = useCurrentSort && sortedData ? sortedData : data;
    if (format === "excel") {
      exportToExcel(exportData, columns, filename);
    } else {
      exportToPDF(exportData, columns, filename, title);
    }
  };

  const handleExcelExport = () => {
    if (isSorted && sortedData) {
      setPendingFormat("excel");
      setDialogOpen(true);
    } else {
      exportToExcel(data, columns, filename);
    }
  };

  const handlePDFExport = () => {
    if (isSorted && sortedData) {
      setPendingFormat("pdf");
      setDialogOpen(true);
    } else {
      exportToPDF(data, columns, filename, title);
    }
  };

  const handleDialogChoice = (useCurrentSort: boolean) => {
    if (pendingFormat) {
      doExport(useCurrentSort, pendingFormat);
    }
    setDialogOpen(false);
    setPendingFormat(null);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={handleExcelExport}
          className="flex items-center gap-2 bg-[#10793F] text-white hover:bg-[#0d6235] hover:text-white border-transparent"
        >
          <Sheet className="h-4 w-4" />
          Export to Excel
        </Button>
        <Button
          variant="outline"
          onClick={handlePDFExport}
          className="flex items-center gap-2 bg-[#FA0F00] text-white hover:bg-[#c80c00] hover:text-white border-transparent"
        >
          <FileText className="h-4 w-4" />
          Export to PDF
        </Button>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Export with current sort order?</AlertDialogTitle>
            <AlertDialogDescription>
              The table has been sorted. Would you like to export the data in
              the current sort order, or in the original order?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleDialogChoice(false)}>
              Use original order
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDialogChoice(true)}>
              Use current sort order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
