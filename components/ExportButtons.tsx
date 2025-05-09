import React from "react";
import { Button } from "@/components/ui/button";
import { Sheet, FileText } from "lucide-react";
import { exportToPDF, exportToExcel } from "@/lib/export-utils";
import { ColumnDef } from "@tanstack/react-table";

interface ExportButtonsProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  filename: string;
  title?: string;
}

export function ExportButtons<T extends Record<string, unknown>>({
  data,
  columns,
  filename,
  title,
}: ExportButtonsProps<T>) {
  const handleExcelExport = () => {
    exportToExcel(data, columns, filename);
  };

  const handlePDFExport = () => {
    exportToPDF(data, columns, filename, title);
  };

  return (
    <div className="flex gap-2 mb-4">
      <Button
        variant="outline"
        onClick={handleExcelExport}
        className="flex items-center gap-2 bg-[#10793F]"
      >
        <Sheet className="h-4 w-4" />
        Export to Excel
      </Button>
      <Button
        variant="outline"
        onClick={handlePDFExport}
        className="flex items-center gap-2 bg-[#FA0F00]"
      >
        <FileText className="h-4 w-4" />
        Export to PDF
      </Button>
    </div>
  );
}
