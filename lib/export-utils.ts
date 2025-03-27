import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Employee } from "@prisma/client";

// Generic interface for table data
export interface TableColumn {
  header: string;
  accessor: keyof Employee;
  format?: (value: any) => string | number;
}
// Excel export function
export const exportToExcel = <T extends Record<string, any>>(
  data: T[],
  columns: TableColumn[],
  filename: string,
) => {
  // Transform data into rows with only the specified columns
  const rows = data.map((item) => {
    const row: Record<string, any> = {};
    columns.forEach((column) => {
      const value = item[column.accessor];
      row[column.header] = column.format ? column.format(value) : value;
    });
    return row;
  });

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  // Generate Excel file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

// PDF export function
export const exportToPDF = <T extends Record<string, any>>(
  data: T[],
  columns: TableColumn[],
  filename: string,
  title?: string,
) => {
  // Initialize PDF document
  const doc = new jsPDF();

  // Add title if provided
  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 15);
  }

  // Prepare data for autoTable
  const headers = columns.map((col) => col.header);
  const rows = data.map((item) =>
    columns.map((column) => {
      const value = item[column.accessor];
      return column.format ? column.format(value) : value;
    }),
  );

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
};
