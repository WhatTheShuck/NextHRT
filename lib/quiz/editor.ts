import type { z } from "zod";
import type { QuizDocument, QuizItem, QuizSection } from "@/lib/quiz/schema";

// ---------------------------------------------------------------------------
// Pure helpers for the visual questionnaire editor. The editor works on a
// QuizDocument draft that may be incomplete (blank prompts, too few options);
// QuizDocumentSchema is the gate on save, and describeIssues turns its errors
// into something an admin can act on.
// ---------------------------------------------------------------------------

export type ItemType = QuizItem["type"];

export const ITEM_TYPES: { type: ItemType; label: string; hint: string }[] = [
  { type: "info", label: "Information", hint: "A card of text — nothing to answer" },
  { type: "choice", label: "Single choice", hint: "Pick one — optionally with a right answer and a tip" },
  { type: "scale", label: "Rating scale", hint: "Pick a point on a labelled scale" },
  { type: "multiselect", label: "Pick any", hint: "Tick all that apply" },
  { type: "text", label: "Free text", hint: "A typed answer" },
];

export function itemTypeLabel(type: ItemType): string {
  return ITEM_TYPES.find((t) => t.type === type)?.label ?? type;
}

const DEFAULT_SCALE = [
  "Never heard of it",
  "Heard of it, never used",
  "Used it a bit",
  "Use it confidently",
  "Could teach it",
];

/** A short random id not already in `taken`. */
export function newId(prefix: string, taken: Set<string>): string {
  for (;;) {
    const id = `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
    if (!taken.has(id)) return id;
  }
}

export function allItemIds(doc: QuizDocument): Set<string> {
  return new Set(doc.sections.flatMap((s) => s.items.map((i) => i.id)));
}

export function allSectionIds(doc: QuizDocument): Set<string> {
  return new Set(doc.sections.map((s) => s.id));
}

/** Next free option id within one item: opt1, opt2, ... */
export function newOptionId(options: { id: string }[]): string {
  const taken = new Set(options.map((o) => o.id));
  let n = options.length + 1;
  while (taken.has(`opt${n}`)) n += 1;
  return `opt${n}`;
}

export function newItem(type: ItemType, id: string): QuizItem {
  switch (type) {
    case "info":
      return { id, type, prompt: "", body: "" };
    case "choice":
      return {
        id,
        type,
        prompt: "",
        options: [
          { id: "opt1", label: "" },
          { id: "opt2", label: "" },
        ],
      };
    case "scale":
      return { id, type, prompt: "", scaleLabels: [...DEFAULT_SCALE] };
    case "multiselect":
      return {
        id,
        type,
        prompt: "",
        options: [
          { id: "opt1", label: "" },
          { id: "opt2", label: "" },
        ],
      };
    case "text":
      return { id, type, prompt: "" };
  }
}

/**
 * Change an item's type, keeping its id and prompt and carrying over whatever
 * translates: option labels between choice/pick-any/scale.
 * Answer-key fields (correct/coaching) only survive choice → choice.
 */
export function convertItem(item: QuizItem, type: ItemType): QuizItem {
  if (item.type === type) return item;
  const base = newItem(type, item.id);
  base.prompt = item.prompt;

  const labels =
    item.type === "scale"
      ? item.scaleLabels
      : "options" in item
        ? item.options.map((o) => o.label)
        : null;

  if ((base.type === "choice" || base.type === "multiselect") && labels && labels.length >= 2) {
    const kept =
      "options" in item ? item.options.map((o) => ({ id: o.id, label: o.label })) : null;
    base.options = kept ?? labels.map((label, i) => ({ id: `opt${i + 1}`, label }));
  }
  if (base.type === "scale" && labels && labels.length >= 2) {
    base.scaleLabels = [...labels];
  }
  return base;
}

export function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = [...arr];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function newSection(doc: QuizDocument): QuizSection {
  const taken = allItemIds(doc);
  return {
    id: newId("section", allSectionIds(doc)),
    title: "",
    items: [newItem("info", newId("item", taken))],
  };
}

export function starterDocument(): QuizDocument {
  return {
    version: 1,
    sections: [
      {
        id: "s0",
        title: "Welcome",
        items: [{ id: "s0_welcome", type: "info", prompt: "Before we start", body: "" }],
      },
    ],
  };
}

/**
 * Choice items in sections before `sectionIndex` — the only legal targets for
 * a section's "show only if" rule.
 */
export function gateCandidates(doc: QuizDocument, sectionIndex: number) {
  const out: { id: string; prompt: string; options: { id: string; label: string }[] }[] = [];
  doc.sections.slice(0, sectionIndex).forEach((s) => {
    for (const item of s.items) {
      if (item.type === "choice") {
        out.push({
          id: item.id,
          prompt: item.prompt,
          options: item.options.map((o) => ({ id: o.id, label: o.label })),
        });
      }
    }
  });
  return out;
}

/** Sections whose show-only-if rule points at this item. */
export function sectionsGatedBy(doc: QuizDocument, itemId: string): QuizSection[] {
  return doc.sections.filter((s) => s.showIf?.itemId === itemId);
}

type Issue = z.core.$ZodIssue;

/**
 * Can the visual editor render a document that failed the shape schema? Only
 * when every issue is a "too small" (blank text, too few options) — those are
 * the states the editor itself produces mid-edit.
 */
export function isRenderable(issues: Issue[]): boolean {
  return issues.every((i) => i.code === "too_small");
}

const FIELD_NAMES: Record<string, string> = {
  title: "title",
  prompt: "question text",
  body: "body text",
  label: "label",
  coaching: "tip",
};

/** Turn schema issues into "Section 2 › Question 3: question text is empty". */
export function describeIssues(doc: QuizDocument, issues: Issue[]): string[] {
  return issues.map((issue) => {
    const p = issue.path;
    const parts: string[] = [];
    let field: string | undefined;

    if (p[0] === "sections" && typeof p[1] === "number") {
      const s = doc.sections[p[1]];
      parts.push(`Section ${p[1] + 1}${s?.title ? ` "${s.title}"` : ""}`);
      if (p[2] === "items" && typeof p[3] === "number") {
        parts.push(`Question ${p[3] + 1}`);
        if ((p[4] === "options" || p[4] === "scaleLabels") && typeof p[5] === "number") {
          parts.push(p[4] === "options" ? `Option ${p[5] + 1}` : `Scale point ${p[5] + 1}`);
          field = typeof p[6] === "string" ? p[6] : undefined;
        } else {
          field = typeof p[4] === "string" ? p[4] : undefined;
        }
      } else if (p[2] === "showIf") {
        parts.push("Show only if");
        field = typeof p[3] === "string" ? p[3] : undefined;
      } else {
        field = typeof p[2] === "string" ? p[2] : undefined;
      }
    }

    let message = issue.message;
    if (issue.code === "too_small") {
      if (issue.origin === "string") {
        message = `${FIELD_NAMES[field ?? ""] ?? field ?? "text"} is empty`;
      } else if (issue.origin === "array") {
        message =
          field === "items"
            ? "needs at least one question"
            : field === "in"
              ? "pick at least one answer"
              : `needs at least ${String(issue.minimum)} ${field === "scaleLabels" ? "scale points" : "options"}`;
      }
    }

    return parts.length ? `${parts.join(" › ")}: ${message}` : message;
  });
}
