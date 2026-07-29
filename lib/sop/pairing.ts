const TASK_SHEET_SUFFIX = " - Task Sheet";
const PRACTICAL_SUFFIX = " - Practical";

export interface SopTrainingLite {
  id: number;
  title: string;
  sopPartnerId: number | null;
}

export interface SopPairResolution {
  pairs: Array<{ taskSheetId: number; practicalId: number; baseTitle: string }>;
  alreadyLinked: number[]; // Task Sheet ids whose link already matches
  orphans: Array<{ id: number; title: string; reason: string }>;
}

/** Pure title-based pairing for the one-off backfill. Reports, never guesses. */
export function resolveSopPairs(trainings: SopTrainingLite[]): SopPairResolution {
  const taskSheets = new Map<string, SopTrainingLite[]>();
  const practicals = new Map<string, SopTrainingLite[]>();
  const result: SopPairResolution = { pairs: [], alreadyLinked: [], orphans: [] };

  for (const training of trainings) {
    if (training.title.endsWith(TASK_SHEET_SUFFIX)) {
      const base = training.title.slice(0, -TASK_SHEET_SUFFIX.length);
      (taskSheets.get(base) ?? taskSheets.set(base, []).get(base)!).push(training);
    } else if (training.title.endsWith(PRACTICAL_SUFFIX)) {
      const base = training.title.slice(0, -PRACTICAL_SUFFIX.length);
      (practicals.get(base) ?? practicals.set(base, []).get(base)!).push(training);
    } else {
      result.orphans.push({ id: training.id, title: training.title, reason: "no recognised suffix" });
    }
  }

  for (const [base, sheets] of taskSheets) {
    const twins = practicals.get(base) ?? [];
    practicals.delete(base);

    if (sheets.length > 1 || twins.length > 1) {
      for (const item of [...sheets, ...twins]) {
        result.orphans.push({ id: item.id, title: item.title, reason: "ambiguous: duplicate titles" });
      }
      continue;
    }
    const sheet = sheets[0];
    if (twins.length === 0) {
      result.orphans.push({ id: sheet.id, title: sheet.title, reason: "missing Practical twin" });
      continue;
    }
    const twin = twins[0];
    if (sheet.sopPartnerId === twin.id) {
      result.alreadyLinked.push(sheet.id);
    } else if (sheet.sopPartnerId !== null) {
      result.orphans.push({
        id: sheet.id,
        title: sheet.title,
        reason: `already linked to a different training (${sheet.sopPartnerId})`,
      });
    } else {
      result.pairs.push({ taskSheetId: sheet.id, practicalId: twin.id, baseTitle: base });
    }
  }

  for (const twins of practicals.values()) {
    for (const twin of twins) {
      result.orphans.push({ id: twin.id, title: twin.title, reason: "missing Task Sheet twin" });
    }
  }

  return result;
}
