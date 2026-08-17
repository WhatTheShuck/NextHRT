import { readFile } from "fs/promises";
import path from "path";
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import prisma from "@/lib/prisma";
import { sopService } from "@/lib/services/sopService";
import { formatDateInZone, formatDateTimeInZone } from "@/lib/dates";

const PAGE_MARGIN = 50;
const TITLE_SIZE = 16;
const HEADING_SIZE = 12;
const QUESTION_SIZE = 11;
const BODY_SIZE = 10;
const SMALL_SIZE = 9;
const LINE_GAP = 6;
const LABEL_WIDTH = 140; // left column of the sign-off details block
const ANSWER_SPACE = 70; // blank space under each question for a written answer

interface QuestionsSectionInput {
  sopTitle: string;
  revisionLabel: string;
  questions: Array<{ order: number; questionText: string }>;
}

export interface CompletionEvidence {
  employeeName: string;
  sopTitle: string;
  revisionLabel: string;
  acknowledgedOn: Date;
  submittedAt: Date | null;
  practicalOn: Date;
  trainerName: string;
  markedAt: Date | null;
  markedByName: string | null;
  rows: Array<{
    order: number;
    questionText: string;
    answerText: string;
    verdict: string | null;
    trainerComment: string | null;
  }>;
}

/**
 * The PDF standard fonts only cover WinAnsi. Answers are free text typed by
 * employees, so anything outside it (emoji, CJK) would throw at draw time and
 * lose them the export. Fold the common typographic characters to ASCII and
 * replace whatever is left, so the record always renders.
 */
function toWinAnsi(text: string): string {
  const folded = text
    .replace(/[‘’‚‹›]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ");
  // Bullets and tabs survive as layout, not as "?" boxes.
  const cleaned = folded
    .replace(/[•·▪]/g, "-")
    .replace(/\t/g, "    ");
  return Array.from(cleaned)
    .map((char) => {
      const code = char.codePointAt(0) ?? 0;
      const encodable =
        (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff);
      return encodable ? char : "?";
    })
    .join("");
}

// Pinned to the app zone: these PDFs are rendered server-side, and the
// container runs as UTC.
function formatDate(value: Date | null): string {
  if (!value) return "—";
  return formatDateInZone(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return formatDateTimeInZone(value);
}

/**
 * Wrap while honouring the author's own line breaks. Answers are typed into a
 * textarea and are routinely numbered lists — collapsing their newlines into
 * one paragraph would misrepresent what the employee actually wrote.
 */
export function layoutParagraph(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  // Split before sanitising: toWinAnsi cannot encode a newline, so running it
  // first would replace every line break with "?" and flatten the answer.
  return text
    .split(/\r?\n/)
    .map(toWinAnsi)
    .flatMap((segment) =>
      segment.trim() === "" ? [""] : wrapText(segment, font, size, maxWidth),
    );
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Pure merge step: procedure PDF bytes + rendered questions appendix.
 * Exported separately from the service so it is unit-testable without I/O.
 */
export async function appendQuestionsSection(
  procedurePdf: Uint8Array,
  input: QuestionsSectionInput,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(procedurePdf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage();
  let { width, height } = page.getSize();
  let y = height - PAGE_MARGIN;
  const maxWidth = width - PAGE_MARGIN * 2;

  const newPage = () => {
    page = doc.addPage();
    ({ width, height } = page.getSize());
    y = height - PAGE_MARGIN;
  };

  page.drawText("Assessment Questions", {
    x: PAGE_MARGIN, y, size: TITLE_SIZE, font: bold,
  });
  y -= TITLE_SIZE + LINE_GAP;
  page.drawText(`${input.sopTitle} — ${input.revisionLabel}`, {
    x: PAGE_MARGIN, y, size: QUESTION_SIZE, font, color: rgb(0.3, 0.3, 0.3),
  });
  y -= QUESTION_SIZE + LINE_GAP * 3;

  for (const question of input.questions) {
    const lines = wrapText(
      `${question.order}. ${question.questionText}`,
      font,
      QUESTION_SIZE,
      maxWidth,
    );
    const blockHeight = lines.length * (QUESTION_SIZE + LINE_GAP) + ANSWER_SPACE;
    if (y - blockHeight < PAGE_MARGIN) newPage();

    for (const line of lines) {
      page.drawText(line, { x: PAGE_MARGIN, y, size: QUESTION_SIZE, font });
      y -= QUESTION_SIZE + LINE_GAP;
    }
    y -= ANSWER_SPACE;
  }

  return doc.save();
}

/**
 * The proof-of-completion document: what was asked, what the employee answered,
 * how the trainer marked it, and when each half was signed off. Rendered fresh
 * per download — never stored.
 */
export async function renderCompletionRecord(
  input: CompletionEvidence,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage();
  let { width, height } = page.getSize();
  let y = height - PAGE_MARGIN;
  const maxWidth = width - PAGE_MARGIN * 2;

  const newPage = () => {
    page = doc.addPage();
    ({ width, height } = page.getSize());
    y = height - PAGE_MARGIN;
  };

  /** Break to a new page if the next block would run past the bottom margin. */
  const reserve = (needed: number) => {
    if (y - needed < PAGE_MARGIN) newPage();
  };

  const draw = (
    text: string,
    opts: {
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      indent?: number;
    } = {},
  ) => {
    const size = opts.size ?? BODY_SIZE;
    const face = opts.font ?? font;
    const indent = opts.indent ?? 0;
    for (const line of layoutParagraph(text, face, size, maxWidth - indent)) {
      reserve(size + LINE_GAP);
      page.drawText(line, {
        x: PAGE_MARGIN + indent,
        y,
        size,
        font: face,
        color: opts.color,
      });
      y -= size + LINE_GAP;
    }
  };

  const drawField = (label: string, value: string) => {
    const lines = layoutParagraph(value, font, BODY_SIZE, maxWidth - LABEL_WIDTH);
    reserve(BODY_SIZE + LINE_GAP);
    page.drawText(toWinAnsi(label), {
      x: PAGE_MARGIN,
      y,
      size: BODY_SIZE,
      font: bold,
    });
    if (lines.length === 0) {
      y -= BODY_SIZE + LINE_GAP;
      return;
    }
    lines.forEach((line, index) => {
      if (index > 0) reserve(BODY_SIZE + LINE_GAP);
      page.drawText(line, {
        x: PAGE_MARGIN + LABEL_WIDTH,
        y,
        size: BODY_SIZE,
        font,
      });
      y -= BODY_SIZE + LINE_GAP;
    });
  };

  draw("SOP Completion Record", { size: TITLE_SIZE, font: bold });
  draw(`${input.sopTitle} — Revision ${input.revisionLabel}`, {
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= LINE_GAP * 2;

  drawField("Employee", input.employeeName);
  drawField("Read and acknowledged", formatDate(input.acknowledgedOn));
  drawField("Submitted for marking", formatDate(input.submittedAt));
  drawField("Practical assessed", formatDate(input.practicalOn));
  drawField("Assessed by", input.trainerName);
  drawField(
    "Marked in HRT",
    input.markedByName
      ? `${formatDateTime(input.markedAt)} by ${input.markedByName}`
      : formatDateTime(input.markedAt),
  );

  y -= LINE_GAP * 2;
  draw("Questions and answers", { size: HEADING_SIZE, font: bold });
  y -= LINE_GAP;

  for (const row of input.rows) {
    // Keep a question with at least the start of its answer.
    reserve((BODY_SIZE + LINE_GAP) * 3);
    draw(`${row.order}. ${row.questionText}`, { font: bold });
    draw(row.answerText || "(no answer recorded)", { indent: 14 });
    draw(
      `Trainer: ${row.verdict ?? "Not marked"}${
        row.trainerComment ? ` — ${row.trainerComment}` : ""
      }`,
      { indent: 14, size: SMALL_SIZE, color: rgb(0.35, 0.35, 0.35) },
    );
    y -= LINE_GAP;
  }

  y -= LINE_GAP * 2;
  draw(
    "Produced by HRT from the employee's submitted answers and the designated trainer's assessment. Each date is the date that step was completed in HRT.",
    { size: SMALL_SIZE, color: rgb(0.4, 0.4, 0.4) },
  );

  return doc.save();
}

class SopPdfService {
  /**
   * Assemble the on-demand SharePoint reference copy: stored procedure PDF +
   * questions appendix. Never stored — rendered fresh per download.
   */
  async assemble(trainingId: number, revisionId: number): Promise<Uint8Array> {
    const pair = await sopService.resolvePair(trainingId);
    if (!pair || pair.taskSheetId !== trainingId) throw new Error("NOT_A_TASK_SHEET");

    const revision = await prisma.trainingRevision.findUnique({
      where: { id: revisionId },
      select: {
        trainingId: true,
        revisionLabel: true,
        documentPath: true,
        training: { select: { title: true } },
        sopQuestions: { orderBy: { order: "asc" } },
      },
    });
    if (!revision || revision.trainingId !== trainingId) {
      throw new Error("REVISION_NOT_FOUND");
    }
    if (!revision.documentPath) throw new Error("SOP_NOT_READY");

    const procedurePdf = await readFile(
      path.join(process.cwd(), "uploads", revision.documentPath),
    );

    return appendQuestionsSection(new Uint8Array(procedurePdf), {
      sopTitle: revision.training.title.replace(/ - Task Sheet$/, ""),
      revisionLabel: revision.revisionLabel,
      questions: revision.sopQuestions.map((q) => ({
        order: q.order,
        questionText: q.questionText,
      })),
    });
  }
}

export const sopPdfService = new SopPdfService();
