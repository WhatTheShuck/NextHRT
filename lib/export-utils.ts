import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ColumnDef } from "@tanstack/react-table";

// Helper function to safely get accessor key from a column definition
function getAccessorKey(column: any): string | null {
  // Check if accessorKey exists (newer API)
  if ("accessorKey" in column && typeof column.accessorKey === "string") {
    return column.accessorKey;
  }

  // Check if accessor exists and is a string (older API)
  if ("accessor" in column && typeof column.accessor === "string") {
    return column.accessor;
  }

  // No valid accessor found
  return null;
}

// Helper function to safely get header from a column definition
function getHeader(column: any): string {
  if (typeof column.header === "string") {
    return column.header;
  }

  // For non-string headers, try to convert or provide a default
  return String(column.header || "");
}

// Utility function to extract export-ready data from table data and columns
function prepareExportData<T>(data: T[], columns: ColumnDef<T, any>[]) {
  // Extract headers
  const headers = columns.map((col) => getHeader(col));

  // Extract data rows
  const rows = data.map((row) => {
    return columns.map((col) => {
      const key = getAccessorKey(col);
      if (!key) return "";

      // Get value and handle special data types
      const value = row[key as keyof T];

      // Handle dates
      if (value instanceof Date) return value.toISOString().split("T")[0];

      // Handle null/undefined
      if (value === null || value === undefined) return "";

      // Return as string
      return String(value);
    });
  });

  return { headers, rows };
}

// Excel export function
export function exportToExcel<T>(
  data: T[],
  columns: ColumnDef<T, any>[],
  filename: string,
) {
  const { headers, rows } = prepareExportData(data, columns);

  // Add headers as first row
  const excelData = [headers, ...rows];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // Generate Excel file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// PDF export function
export function exportToPDF<T>(
  data: T[],
  columns: ColumnDef<T, any>[],
  filename: string,
  title?: string,
) {
  const { headers, rows } = prepareExportData(data, columns);

  // Initialize PDF document
  const doc = new jsPDF();

  // Add title if provided
  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 15);
  }

  // Generate table
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: title ? 25 : 10,
    margin: { top: 10 },
    styles: { fontSize: 9 },
    headStyles: { fillColor: [66, 66, 66] },
  });

  // Save PDF
  doc.save(`${filename}.pdf`);
}
