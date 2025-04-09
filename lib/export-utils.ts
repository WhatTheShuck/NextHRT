import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ColumnDef } from "@tanstack/react-table";

// Helper function to safely get value from a column definition

function getValueFromRow<T>(row: T, column: ColumnDef<T, any>): any {
  // Case 1: Column has an accessorFn
  if ("accessorFn" in column && typeof column.accessorFn === "function") {
    return (column.accessorFn as (row: T) => any)(row);
  }

  // Case 2: Column has an accessorKey (string path)
  if ("accessorKey" in column && typeof column.accessorKey === "string") {
    // Handle nested paths like "personTrained.firstName"
    const path = column.accessorKey.split(".");
    let value = row as any;

    // Navigate through the nested path
    for (const key of path) {
      if (value === null || value === undefined) return "";
      value = value[key];
    }

    return value;
  }

  // No valid accessor found
  return "";
}

// Helper function to safely get header from a column definition
function getHeaderText(column: any): string {
  if (column.meta && typeof column.meta.headerText === "string") {
    return column.meta.headerText;
  }

  // If the header is a string, return it directly
  if (typeof column.header === "string") {
    return column.header;
  }
  // For non-string headers, try to convert or provide a default
  return String(column.meta.headerText || "Column");
}
// Format a value for export (handling dates, etc.)
function formatValueForExport(value: any): string {
  // Handle dates
  if (value instanceof Date) {
    return value.toLocaleDateString();
  }

  // If the value is already formatted as a date string by accessorFn
  if (typeof value === "string" && (value.includes("/") || value === "N/A")) {
    return value;
  }

  // Handle null/undefined
  if (value === null || value === undefined) {
    return "";
  }

  // Return as string
  return String(value);
}
// Utility function to extract export-ready data from table data and columns
function prepareExportData<T>(data: T[], columns: ColumnDef<T, any>[]) {
  // Extract headers
  const headers = columns.map((col) => getHeaderText(col));

  // Extract data rows
  const rows = data.map((row) => {
    return columns.map((col) => {
      // Get value using the column definition
      const value = getValueFromRow(row, col);

      // Format the value for export
      return formatValueForExport(value);
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
