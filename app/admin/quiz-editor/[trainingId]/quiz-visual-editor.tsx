"use client";

import { useState } from "react";
import type { QuizDocument, QuizItem, QuizSection } from "@/lib/quiz/schema";
import {
  ITEM_TYPES,
  allItemIds,
  convertItem,
  gateCandidates,
  itemTypeLabel,
  move,
  newId,
  newItem,
  newOptionId,
  newSection,
  sectionsGatedBy,
  type ItemType,
} from "@/lib/quiz/editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  GitBranch,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  doc: QuizDocument;
  onChange: (doc: QuizDocument) => void;
  disabled?: boolean;
}

const ALWAYS = "__always__";
const NO_CORRECT = "__none__";

/** Small icon button used for reorder/delete controls. */
function IconButton({
  label,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 shrink-0", className)}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}

/**
 * Visual editor for a QuizDocument. Stateless apart from which questions are
 * expanded — every edit produces a new document through onChange. Item and
 * option ids are generated and never changed here, because saved answers are
 * keyed by them.
 */
export function QuizVisualEditor({ doc, onChange, disabled }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deletingSection, setDeletingSection] = useState<number | null>(null);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setSections = (sections: QuizSection[]) => onChange({ ...doc, sections });

  const updateSection = (si: number, patch: Partial<QuizSection>) =>
    setSections(doc.sections.map((s, i) => (i === si ? { ...s, ...patch } : s)));

  const updateItem = (si: number, ii: number, item: QuizItem) =>
    updateSection(si, {
      items: doc.sections[si].items.map((it, i) => (i === ii ? item : it)),
    });

  // Removing an option from a gate question also drops it from any section's
  // show-only-if list, so the rule doesn't point at an option that's gone.
  const removeOption = (si: number, ii: number, optionId: string) => {
    const item = doc.sections[si].items[ii];
    if (!("options" in item)) return;
    const updated = { ...item, options: item.options.filter((o) => o.id !== optionId) } as QuizItem;
    onChange({
      ...doc,
      sections: doc.sections.map((s, i) => {
        let next = s;
        if (i === si) {
          next = { ...s, items: s.items.map((it, j) => (j === ii ? updated : it)) };
        }
        if (next.showIf?.itemId === item.id) {
          next = { ...next, showIf: { ...next.showIf, in: next.showIf.in.filter((x) => x !== optionId) } };
        }
        return next;
      }),
    });
  };

  const addItem = (si: number, type: ItemType) => {
    const item = newItem(type, newId("item", allItemIds(doc)));
    updateSection(si, { items: [...doc.sections[si].items, item] });
    setExpanded((prev) => new Set(prev).add(item.id));
  };

  const addSection = () => {
    const section = newSection(doc);
    setSections([...doc.sections, section]);
    setExpanded((prev) => new Set(prev).add(section.items[0].id));
  };

  return (
    <div className="space-y-4">
      {doc.sections.map((section, si) => {
        const gates = gateCandidates(doc, si);
        const gate = section.showIf ? gates.find((g) => g.id === section.showIf!.itemId) : undefined;
        return (
          <Card key={section.id}>
            <CardHeader className="space-y-3 pb-3" data-tour="quiz-section">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="shrink-0">
                  Section {si + 1}
                </Badge>
                <Input
                  value={section.title}
                  onChange={(e) => updateSection(si, { title: e.target.value })}
                  placeholder="Section title"
                  className="font-medium"
                  disabled={disabled}
                  aria-label={`Section ${si + 1} title`}
                />
                <IconButton
                  label="Move section up"
                  onClick={() => setSections(move(doc.sections, si, si - 1))}
                  disabled={disabled || si === 0}
                >
                  <ArrowUp className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Move section down"
                  onClick={() => setSections(move(doc.sections, si, si + 1))}
                  disabled={disabled || si === doc.sections.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Delete section"
                  onClick={() => setDeletingSection(si)}
                  disabled={disabled || doc.sections.length === 1}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </div>

              {/* Show-only-if (branching) */}
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Show this section</span>
                  <Select
                    value={section.showIf?.itemId ?? ALWAYS}
                    onValueChange={(v) =>
                      updateSection(si, {
                        showIf: v === ALWAYS ? undefined : { itemId: v, in: [] },
                      })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 w-auto max-w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALWAYS}>to everyone</SelectItem>
                      {gates.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          only if “{g.prompt || "Untitled question"}” is…
                        </SelectItem>
                      ))}
                      {section.showIf && !gate && (
                        <SelectItem value={section.showIf.itemId}>
                          (missing question “{section.showIf.itemId}”)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {section.showIf && gate && (
                  <div className="flex flex-wrap gap-x-4 gap-y-2 pl-6">
                    {gate.options.map((opt) => {
                      const checked = section.showIf!.in.includes(opt.id);
                      return (
                        <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={(v) => {
                              const inList = section.showIf!.in;
                              updateSection(si, {
                                showIf: {
                                  itemId: gate.id,
                                  in: v ? [...inList, opt.id] : inList.filter((x) => x !== opt.id),
                                },
                              });
                            }}
                          />
                          {opt.label || <span className="italic text-muted-foreground">Untitled option</span>}
                        </label>
                      );
                    })}
                  </div>
                )}
                {gates.length === 0 && !section.showIf && (
                  <p className="text-xs text-muted-foreground pl-6">
                    To branch, add a single-choice question in an earlier section.
                  </p>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-2">
              {section.items.map((item, ii) => (
                <ItemEditor
                  key={item.id}
                  item={item}
                  index={ii}
                  count={section.items.length}
                  open={expanded.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  gatedSections={sectionsGatedBy(doc, item.id)}
                  disabled={disabled}
                  onChange={(next) => updateItem(si, ii, next)}
                  onRemoveOption={(optionId) => removeOption(si, ii, optionId)}
                  onMove={(to) => updateSection(si, { items: move(section.items, ii, to) })}
                  onDelete={() =>
                    updateSection(si, { items: section.items.filter((_, i) => i !== ii) })
                  }
                />
              ))}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={disabled} data-tour="quiz-add-question">
                    <Plus className="h-4 w-4 mr-1" /> Add question
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {ITEM_TYPES.map((t) => (
                    <DropdownMenuItem key={t.type} onSelect={() => addItem(si, t.type)}>
                      <div>
                        <p className="font-medium">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.hint}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>
        );
      })}

      <Button type="button" variant="outline" onClick={addSection} disabled={disabled}>
        <Plus className="h-4 w-4 mr-1" /> Add section
      </Button>

      <AlertDialog
        open={deletingSection !== null}
        onOpenChange={(open) => !open && setDeletingSection(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this section?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSection !== null &&
                `“${doc.sections[deletingSection]?.title || "Untitled section"}” and its ${
                  doc.sections[deletingSection]?.items.length ?? 0
                } question(s) will be removed from the draft. Nothing is saved until you click Save.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingSection !== null) {
                  setSections(doc.sections.filter((_, i) => i !== deletingSection));
                }
                setDeletingSection(null);
              }}
            >
              Delete section
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── One question ────────────────────────────────────────────────────────────

interface ItemEditorProps {
  item: QuizItem;
  index: number;
  count: number;
  open: boolean;
  onToggle: () => void;
  gatedSections: QuizSection[];
  disabled?: boolean;
  onChange: (item: QuizItem) => void;
  onRemoveOption: (optionId: string) => void;
  onMove: (to: number) => void;
  onDelete: () => void;
}

function ItemEditor({
  item,
  index,
  count,
  open,
  onToggle,
  gatedSections,
  disabled,
  onChange,
  onRemoveOption,
  onMove,
  onDelete,
}: ItemEditorProps) {
  return (
    <div className="rounded-md border" data-tour="quiz-question">
      <div className="flex items-center gap-1 p-1 pl-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-sm"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0" />
          )}
          <span className="text-muted-foreground shrink-0">{index + 1}.</span>
          <Badge variant="secondary" className="shrink-0 text-xs font-normal">
            {itemTypeLabel(item.type)}
          </Badge>
          <span className={cn("truncate", !item.prompt && "italic text-muted-foreground")}>
            {item.prompt || "Untitled"}
          </span>
          {gatedSections.length > 0 && (
            <Badge variant="outline" className="shrink-0 text-xs font-normal hidden sm:inline-flex">
              <GitBranch className="h-3 w-3 mr-1" />
              branches {gatedSections.length}
            </Badge>
          )}
        </button>
        <IconButton label="Move question up" onClick={() => onMove(index - 1)} disabled={disabled || index === 0}>
          <ArrowUp className="h-4 w-4" />
        </IconButton>
        <IconButton
          label="Move question down"
          onClick={() => onMove(index + 1)}
          disabled={disabled || index === count - 1}
        >
          <ArrowDown className="h-4 w-4" />
        </IconButton>
        <IconButton label="Delete question" onClick={onDelete} disabled={disabled} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      {open && (
        <div className="space-y-4 border-t p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs">{item.type === "info" ? "Heading" : "Question"}</Label>
              <Textarea
                value={item.prompt}
                onChange={(e) => onChange({ ...item, prompt: e.target.value })}
                rows={2}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select
                value={item.type}
                onValueChange={(v) => onChange(convertItem(item, v as ItemType))}
                disabled={disabled}
              >
                <SelectTrigger className="sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_TYPES.map((t) => (
                    <SelectItem key={t.type} value={t.type}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {gatedSections.length > 0 && (
            <p className="text-xs text-muted-foreground flex gap-1">
              <GitBranch className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              Decides whether these sections are shown:{" "}
              {gatedSections.map((s) => s.title || "Untitled section").join(", ")}
            </p>
          )}

          {item.type === "info" && (
            <div className="space-y-1">
              <Label className="text-xs">Body</Label>
              <Textarea
                value={item.body}
                onChange={(e) => onChange({ ...item, body: e.target.value })}
                rows={4}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">Each line becomes its own paragraph.</p>
            </div>
          )}

          {item.type === "text" && (
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={item.optional === true}
                onCheckedChange={(v) =>
                  onChange(
                    v
                      ? { ...item, optional: true }
                      : { id: item.id, type: "text", prompt: item.prompt },
                  )
                }
                disabled={disabled}
              />
              Optional — employees can leave it blank
            </label>
          )}

          {item.type === "scale" && (
            <LabelList
              heading="Scale points (lowest first)"
              labels={item.scaleLabels}
              addLabel="Add scale point"
              disabled={disabled}
              onChange={(scaleLabels) => onChange({ ...item, scaleLabels })}
            />
          )}

          {item.type === "multiselect" && (
            <OptionList
              options={item.options}
              disabled={disabled}
              onChange={(options) => onChange({ ...item, options })}
              onRemove={onRemoveOption}
            />
          )}

          {item.type === "choice" && (
            <ChoiceEditor item={item} disabled={disabled} onChange={onChange} onRemove={onRemoveOption} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Lists ───────────────────────────────────────────────────────────────────

function LabelList({
  heading,
  labels,
  addLabel,
  disabled,
  onChange,
}: {
  heading: string;
  labels: string[];
  addLabel: string;
  disabled?: boolean;
  onChange: (labels: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{heading}</Label>
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="w-6 shrink-0 text-xs text-muted-foreground">{i + 1}.</span>
          <Input
            value={label}
            onChange={(e) => onChange(labels.map((l, j) => (j === i ? e.target.value : l)))}
            disabled={disabled}
          />
          <IconButton label="Move up" onClick={() => onChange(move(labels, i, i - 1))} disabled={disabled || i === 0}>
            <ArrowUp className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Move down"
            onClick={() => onChange(move(labels, i, i + 1))}
            disabled={disabled || i === labels.length - 1}
          >
            <ArrowDown className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Remove"
            onClick={() => onChange(labels.filter((_, j) => j !== i))}
            disabled={disabled || labels.length <= 2}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...labels, ""])} disabled={disabled}>
        <Plus className="h-4 w-4 mr-1" /> {addLabel}
      </Button>
    </div>
  );
}

type PlainOption = { id: string; label: string };

function OptionList<O extends PlainOption>({
  options,
  disabled,
  onChange,
  onRemove,
  leading,
}: {
  options: O[];
  disabled?: boolean;
  onChange: (options: O[]) => void;
  onRemove: (optionId: string) => void;
  leading?: (opt: O) => React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">Options</Label>
      {options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-1">
          {leading?.(opt)}
          <Input
            value={opt.label}
            onChange={(e) =>
              onChange(options.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))
            }
            placeholder={`Option ${i + 1}`}
            disabled={disabled}
          />
          <IconButton label="Move up" onClick={() => onChange(move(options, i, i - 1))} disabled={disabled || i === 0}>
            <ArrowUp className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Move down"
            onClick={() => onChange(move(options, i, i + 1))}
            disabled={disabled || i === options.length - 1}
          >
            <ArrowDown className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Remove option"
            onClick={() => onRemove(opt.id)}
            disabled={disabled || options.length <= 2}
            className="text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...options, { id: newOptionId(options), label: "" } as O])}
        disabled={disabled}
      >
        <Plus className="h-4 w-4 mr-1" /> Add option
      </Button>
    </div>
  );
}

/**
 * Single choice: options plus an optional right answer. The tip is edited as a
 * property of the question but stored on the correct option (the only coaching
 * the player ever reveals), so it follows the right answer when that changes.
 */
function ChoiceEditor({
  item,
  disabled,
  onChange,
  onRemove,
}: {
  item: Extract<QuizItem, { type: "choice" }>;
  disabled?: boolean;
  onChange: (item: QuizItem) => void;
  onRemove: (optionId: string) => void;
}) {
  const correct = item.options.find((o) => o.correct);
  const tip = correct?.coaching ?? "";

  const setCorrect = (id: string) => {
    onChange({
      ...item,
      options: item.options.map((o) => {
        const plain = { id: o.id, label: o.label };
        if (o.id !== id) return plain;
        return { ...plain, correct: true, ...(tip ? { coaching: tip } : {}) };
      }),
    });
  };

  const setTip = (text: string) => {
    onChange({
      ...item,
      options: item.options.map((o) => {
        if (!o.correct) return o;
        return { id: o.id, label: o.label, correct: true, ...(text ? { coaching: text } : {}) };
      }),
    });
  };

  return (
    <RadioGroup
      value={correct?.id ?? NO_CORRECT}
      onValueChange={setCorrect}
      disabled={disabled}
      className="space-y-3"
    >
      <OptionList
        options={item.options}
        disabled={disabled}
        onChange={(options) => onChange({ ...item, options })}
        onRemove={onRemove}
        leading={(opt) => (
          <RadioGroupItem
            value={opt.id}
            aria-label={`Mark “${opt.label || "option"}” as the right answer`}
            title="Right answer"
            className="mx-2 shrink-0"
          />
        )}
      />
      <p className="text-xs text-muted-foreground -mt-1">
        Select the circle beside the right answer. Employees see whether they were
        right and the tip below, and can&apos;t change that answer afterwards.
      </p>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <RadioGroupItem value={NO_CORRECT} className="mx-2" />
        No right answer — a survey or branching question
      </label>
      {correct && (
        <div className="space-y-1">
          <Label className="text-xs">Tip shown after answering</Label>
          <Textarea value={tip} onChange={(e) => setTip(e.target.value)} rows={3} disabled={disabled} />
        </div>
      )}
    </RadioGroup>
  );
}
