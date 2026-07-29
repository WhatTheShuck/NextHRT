import { z } from "zod";

// ---------------------------------------------------------------------------
// QuizDocument — the interactive-quiz content stored (as JSON) on a
// TrainingRevision. Validated on every write. Shared by the server (validation,
// branch resolution, answer-key stripping) and the player.
//
// Cross-field rules the flat object schemas can't express are enforced in the
// document-level superRefine: unique item ids, unique option ids, one correct
// option per choice, showIf references an EARLIER choice item + real option ids,
// and no coaching on the options of a choice that has no correct option.
// ---------------------------------------------------------------------------

// Options for correct/coaching-bearing choice items.
const ChoiceOptionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  correct: z.boolean().optional(),
  coaching: z.string().min(1).optional(),
});

// Multiselect options are pure self-assessment: correct/coaching are forbidden
// (strictObject rejects them as unrecognized keys).
const PlainOptionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
});

const InfoItemSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("info"),
  prompt: z.string().min(1),
  body: z.string().min(1),
});

const ChoiceItemSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("choice"),
  prompt: z.string().min(1),
  options: z.array(ChoiceOptionSchema).min(2),
});

const ScaleItemSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("scale"),
  prompt: z.string().min(1),
  scaleLabels: z.array(z.string().min(1)).min(2),
});

const MultiselectItemSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("multiselect"),
  prompt: z.string().min(1),
  options: z.array(PlainOptionSchema).min(2),
});

const TextItemSchema = z.strictObject({
  id: z.string().min(1),
  type: z.literal("text"),
  prompt: z.string().min(1),
  optional: z.boolean().optional(),
});

const QuizItemSchema = z.discriminatedUnion("type", [
  InfoItemSchema,
  ChoiceItemSchema,
  ScaleItemSchema,
  MultiselectItemSchema,
  TextItemSchema,
]);

const SectionSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  showIf: z
    .strictObject({
      itemId: z.string().min(1),
      in: z.array(z.string().min(1)).min(1),
    })
    .optional(),
  items: z.array(QuizItemSchema).min(1),
});

export const QuizDocumentSchema = z
  .strictObject({
    version: z.literal(1),
    sections: z.array(SectionSchema).min(1),
  })
  .superRefine((doc, ctx) => {
    // Walk items in document order, tracking a global index so "earlier" is
    // well-defined for showIf.
    const itemIndex = new Map<
      string,
      { type: string; optionIds: Set<string>; hasCorrect: boolean; globalIndex: number }
    >();
    let globalIndex = 0;
    const sectionStart: number[] = [];

    doc.sections.forEach((section, sIdx) => {
      sectionStart[sIdx] = globalIndex;
      section.items.forEach((item) => {
        // Unique item ids across the whole document.
        if (itemIndex.has(item.id)) {
          ctx.addIssue({ code: "custom", message: `Duplicate item id "${item.id}"` });
        }

        const options = "options" in item ? item.options : undefined;
        const optionIds = new Set<string>();
        let hasCorrect = false;
        if (options) {
          for (const opt of options) {
            if (optionIds.has(opt.id)) {
              ctx.addIssue({
                code: "custom",
                message: `Duplicate option id "${opt.id}" in item "${item.id}"`,
              });
            }
            optionIds.add(opt.id);
            if ("correct" in opt && opt.correct) hasCorrect = true;
          }
        }

        // A choice may have at most one correct option.
        if (item.type === "choice") {
          const correctCount = item.options.filter((o) => o.correct).length;
          if (correctCount > 1) {
            ctx.addIssue({
              code: "custom",
              message: `Choice "${item.id}" has more than one correct option`,
            });
          }
          // Coaching on a correct-less choice never reveals — forbid it.
          if (correctCount === 0) {
            for (const o of item.options) {
              if (o.coaching) {
                ctx.addIssue({
                  code: "custom",
                  message: `Option "${o.id}" in survey choice "${item.id}" has coaching but the choice has no correct option`,
                });
              }
            }
          }
        }

        itemIndex.set(item.id, { type: item.type, optionIds, hasCorrect, globalIndex });
        globalIndex += 1;
      });
    });

    // showIf must reference an EARLIER choice item and real option ids.
    doc.sections.forEach((section, sIdx) => {
      if (!section.showIf) return;
      const ref = itemIndex.get(section.showIf.itemId);
      if (!ref) {
        ctx.addIssue({
          code: "custom",
          message: `Section "${section.id}" showIf references unknown item "${section.showIf.itemId}"`,
        });
        return;
      }
      if (ref.type !== "choice") {
        ctx.addIssue({
          code: "custom",
          message: `Section "${section.id}" showIf must reference a choice item`,
        });
        return;
      }
      if (ref.globalIndex >= sectionStart[sIdx]) {
        ctx.addIssue({
          code: "custom",
          message: `Section "${section.id}" showIf must reference an earlier item`,
        });
        return;
      }
      for (const optId of section.showIf.in) {
        if (!ref.optionIds.has(optId)) {
          ctx.addIssue({
            code: "custom",
            message: `Section "${section.id}" showIf references unknown option "${optId}"`,
          });
        }
      }
    });
  });

export type QuizDocument = z.infer<typeof QuizDocumentSchema>;
export type QuizSection = QuizDocument["sections"][number];
export type QuizItem = QuizSection["items"][number];
export type QuizOption = z.infer<typeof ChoiceOptionSchema>;

/**
 * Parse + validate a stored JSON string into a QuizDocument. Throws a readable
 * error (JSON syntax or zod validation) — used by the service on every write.
 */
export function parseQuizDocument(json: string): QuizDocument {
  const parsed = JSON.parse(json) as unknown;
  return QuizDocumentSchema.parse(parsed);
}

/**
 * The items visible under a given set of answers, in document order. A section
 * with no showIf is always visible; a section with showIf is included only when
 * the referenced gate answer is one of showIf.in.
 */
export function visibleItems(
  doc: QuizDocument,
  answers: Record<string, unknown>,
): { sectionId: string; item: QuizItem }[] {
  const out: { sectionId: string; item: QuizItem }[] = [];
  for (const section of doc.sections) {
    if (section.showIf) {
      const gate = answers[section.showIf.itemId];
      const gateValue = extractAnswerValue(gate);
      if (typeof gateValue !== "string" || !section.showIf.in.includes(gateValue)) {
        continue;
      }
    }
    for (const item of section.items) out.push({ sectionId: section.id, item });
  }
  return out;
}

// Answers are stored as { value, wasCorrect? } but callers sometimes pass raw
// values; accept both so branch resolution works on either shape.
function extractAnswerValue(answer: unknown): unknown {
  if (answer && typeof answer === "object" && "value" in answer) {
    return (answer as { value: unknown }).value;
  }
  return answer;
}

/**
 * Deep-clone the document with `correct` and `coaching` removed from every
 * option — the only shape the player GET returns to non-admins. The original
 * document is left untouched.
 */
export function stripAnswerKey(doc: QuizDocument): QuizDocument {
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => {
        if (!("options" in item) || !item.options) return item;
        return {
          ...item,
          options: item.options.map((opt) => {
            const clean: { id: string; label: string } = { id: opt.id, label: opt.label };
            return clean;
          }),
        };
      }),
    })),
  } as QuizDocument;
}
