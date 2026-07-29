"use client";

import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface AssessmentExportData {
  sopTitle: string;
  revisionLabel: string;
  employeeName: string;
  trainerName: string | null;
  submittedAt: string | null;
  markedAt: string | null;
  status: string;
  rows: Array<{
    order: number;
    questionText: string;
    answerText: string;
    verdict: string | null;
    trainerComment: string | null;
  }>;
}

export function AssessmentExportButton({ data }: { data: AssessmentExportData }) {
  const handleExport = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`SOP Assessment — ${data.sopTitle} (${data.revisionLabel})`, 14, 18);
    doc.setFontSize(10);
    doc.text(
      [
        `Employee: ${data.employeeName}`,
        `Trainer: ${data.trainerName ?? "—"}`,
        `Submitted: ${data.submittedAt ?? "—"}    Marked: ${data.markedAt ?? "—"}    Status: ${data.status}`,
      ],
      14,
      26,
    );
    autoTable(doc, {
      startY: 44,
      head: [["#", "Question", "Answer", "Verdict", "Comment"]],
      body: data.rows.map((row) => [
        row.order,
        row.questionText,
        row.answerText,
        row.verdict ?? "—",
        row.trainerComment ?? "",
      ]),
      styles: { fontSize: 9, cellPadding: 2, overflow: "linebreak" },
      columnStyles: { 1: { cellWidth: 55 }, 2: { cellWidth: 60 } },
    });
    doc.save(`sop-assessment-${data.sopTitle.replace(/\s+/g, "-").toLowerCase()}.pdf`);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <FileDown className="mr-2 h-4 w-4" />
      Export PDF
    </Button>
  );
}
