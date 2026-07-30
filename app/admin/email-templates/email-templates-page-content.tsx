"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { toast } from "sonner";
import {
  AlertTriangle,
  History,
  Mail,
  RotateCcw,
  Save,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
import { EmailBodyEditor } from "@/components/email-editor/email-body-editor";
import { EmailPreview } from "@/components/email-editor/email-preview";
import { TemplateHistoryDialog } from "@/components/email-editor/template-history-dialog";
import { TokenChips } from "@/components/email-editor/token-chips";
import { FieldPicker } from "@/components/email-editor/field-picker";
import { insertAtCursor } from "@/components/email-editor/insert-at-cursor";
import { describeRequestError } from "@/components/email-editor/request-error";
import {
  GROUP_ORDER,
  unbalancedConditionals,
  unknownTokens,
  type TemplateGroup,
  type TemplateKind,
} from "@/lib/email-templates/tokens";

/**
 * How long to wait on a test send. Generous on purpose: it covers a full SMTP
 * exchange rather than a database read, and reporting a false failure for a slow
 * relay is worse than making the admin wait.
 */
const TEST_SEND_TIMEOUT_MS = 60_000;

interface TemplateWithMeta {
  key: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
  group: TemplateGroup;
  kind: TemplateKind;
  blurb: string;
  tokens: string[];
  isEdited: boolean;
  isPlaceholder: boolean;
  unknownTokens: string[];
  rowKey?: string;
}

const GROUP_BLURBS: Record<TemplateGroup, string> = {
  Onboarding: "Sent when an onboarding request is approved.",
  IT: "Requests and summaries sent to the IT team.",
  Tickets: "Automatic reminders about expiring tickets and credentials.",
  SOP: "Notifications about SOP assessments.",
  Advanced:
    "Building blocks used inside the emails above — the shared layout and the row formats for generated lists.",
};

export function EmailTemplatesPageContent() {
  const [templates, setTemplates] = useState<TemplateWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = useCallback(async (keepSelection = true) => {
    try {
      setLoadError(null);
      const res = await api.get<TemplateWithMeta[]>("/api/email-templates");
      setTemplates(res.data);
      setSelectedKey((current) => {
        if (keepSelection && current !== null) return current;
        // Open on a real email, not whichever key sorts first. Alphabetically
        // that is email.layout — an Advanced fragment edited as raw HTML, which
        // is a misleading first impression of the editor.
        const firstEmail = res.data.find((t) => t.kind === "email");
        return (firstEmail ?? res.data[0])?.key ?? null;
      });
    } catch (err) {
      setLoadError(
        err instanceof AxiosError && err.response?.status === 403
          ? "You do not have permission to manage email templates."
          : "Could not load the email templates.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const selected = templates.find((t) => t.key === selectedKey) ?? null;

  const grouped = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        items: templates.filter((t) => t.group === group),
      })).filter((g) => g.items.length > 0),
    [templates],
  );

  return (
    <div className="container mx-auto px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <Mail className="h-7 w-7" />
          Email Templates
        </h1>
        <p className="mt-1 text-muted-foreground">
          Edit the wording of every automatic email the system sends. Changes take
          effect on the next send — preview or send yourself a test first.
        </p>
      </div>

      {loadError !== null && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <nav className="space-y-6" aria-label="Email templates">
            {grouped.map(({ group, items }) => (
              <div key={group} className="space-y-1.5">
                <div>
                  <h2 className="text-sm font-semibold">{group}</h2>
                  <p className="text-xs text-muted-foreground">
                    {GROUP_BLURBS[group]}
                  </p>
                </div>
                <ul className="space-y-1">
                  {items.map((t) => (
                    <li key={t.key}>
                      <TemplateListButton
                        template={t}
                        selected={t.key === selectedKey}
                        onSelect={() => setSelectedKey(t.key)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {selected !== null && (
            <TemplateEditorPanel
              // Remount on selection so the editor and its draft state reset
              // cleanly rather than carrying another template's copy across.
              key={selected.key}
              template={selected}
              onSaved={() => load(true)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TemplateListButton({
  template,
  selected,
  onSelect,
}: {
  template: TemplateWithMeta;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={cn(
        "w-full rounded-md border p-2.5 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "hover:border-muted-foreground/30 hover:bg-muted/50",
      )}
    >
      <p className="truncate text-sm font-medium">{template.name}</p>
      <p className="truncate font-mono text-xs text-muted-foreground">
        {template.key}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {!template.isActive && <Badge variant="destructive">Off</Badge>}
        {template.isPlaceholder && (
          <Badge variant="destructive">Not written yet</Badge>
        )}
        {template.unknownTokens.length > 0 && (
          <Badge variant="destructive">Unknown token</Badge>
        )}
        <Badge variant={template.isEdited ? "default" : "secondary"}>
          {template.isEdited ? "Edited" : "Default"}
        </Badge>
      </div>
    </button>
  );
}

function TemplateEditorPanel({
  template,
  onSaved,
}: {
  template: TemplateWithMeta;
  onSaved: () => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [isActive, setIsActive] = useState(template.isActive);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const subjectRef = useRef<HTMLInputElement>(null);

  const isFragment = template.kind === "fragment";
  const dirty =
    subject !== template.subject ||
    body !== template.body ||
    isActive !== template.isActive;

  // Checked as you type, not only when the preview runs: both checks are pure
  // string work over the same registry the server uses, so there is no reason to
  // make an author open another tab to find out they mistyped a field name.
  const problems = useMemo(() => {
    const unknown = [
      ...new Set([
        ...unknownTokens(template.key, subject),
        ...unknownTokens(template.key, body),
      ]),
    ];
    const unclosed = [
      ...new Set([
        ...unbalancedConditionals(subject),
        ...unbalancedConditionals(body),
      ]),
    ];
    return { unknown, unclosed };
  }, [template.key, subject, body]);

  // Fragments have no subject of their own — they are composed into a parent
  // email that supplies one.
  const showSubject = !isFragment;

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.put(
        `/api/email-templates/${encodeURIComponent(template.key)}`,
        { subject, body, isActive },
      );
      toast.success(`Saved "${template.name}".`);
      onSaved();
    } catch (err) {
      setError(describeRequestError(err, "save the template"));
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    try {
      setTesting(true);
      setError(null);
      const res = await api.post<{ sentTo: string }>(
        `/api/email-templates/${encodeURIComponent(template.key)}/test`,
        { subject, body },
        // This request waits on the whole SMTP exchange — connect, STARTTLS,
        // auth, send — which is the one place in the app that does. The shared
        // 10s client default is short enough that a merely slow relay would
        // report failure for a message that went out fine.
        { timeout: TEST_SEND_TIMEOUT_MS },
      );
      toast.success(`Test email sent to ${res.data.sentTo}.`);
    } catch (err) {
      setError(
        describeRequestError(
          err,
          "send the test email",
          "The mail server did not respond in time. The message may still have been sent — check your inbox before trying again.",
        ),
      );
    } finally {
      setTesting(false);
    }
  };

  const revert = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await api.post<{ subject: string; body: string }>(
        `/api/email-templates/${encodeURIComponent(template.key)}/revert`,
      );
      setSubject(res.data.subject);
      setBody(res.data.body);
      setIsActive(true);
      toast.success(`"${template.name}" restored to its default wording.`);
      onSaved();
    } catch (err) {
      setError(describeRequestError(err, "revert the template"));
    } finally {
      setSaving(false);
      setConfirmRevert(false);
    }
  };

  const insertIntoSubject = (token: string) => {
    const el = subjectRef.current;
    if (el) setSubject(insertAtCursor(el, `{${token}}`));
  };

  const reloadAfterRestore = async () => {
    try {
      const res = await api.get<{ subject: string; body: string; isActive: boolean }>(
        `/api/email-templates/${encodeURIComponent(template.key)}`,
      );
      setSubject(res.data.subject);
      setBody(res.data.body);
      setIsActive(res.data.isActive);
      toast.success("Version restored.");
      onSaved();
    } catch {
      setError("Restored, but could not reload the template.");
    }
  };

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold">{template.name}</h2>
          <p className="font-mono text-xs text-muted-foreground">
            {template.key}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="template-active"
            checked={isActive}
            onCheckedChange={setIsActive}
          />
          <Label htmlFor="template-active" className="text-sm">
            {isActive ? "Sending" : "Switched off"}
          </Label>
        </div>
      </div>

      {template.blurb !== "" && (
        <p className="text-sm text-muted-foreground">{template.blurb}</p>
      )}

      {!isActive && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {template.key === "email.layout"
              ? "With the layout switched off, emails are sent as plain message bodies with no header or footer."
              : "This email will not be sent while it is switched off. Everything else about its job still runs."}
          </AlertDescription>
        </Alert>
      )}

      {template.isPlaceholder && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            The copy for this email has never been written — it currently sends
            the placeholder text below. Replace it, or switch the template off
            until it is ready.
          </AlertDescription>
        </Alert>
      )}

      {template.rowKey !== undefined && (
        <p className="text-sm text-muted-foreground">
          The list in this email is built from{" "}
          <span className="font-mono text-xs">{template.rowKey}</span>, under{" "}
          <strong>Advanced</strong> — edit that to change the format of each row.
        </p>
      )}

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4 space-y-4">
          {showSubject && (
            <div className="space-y-2">
              <Label htmlFor="template-subject">Subject</Label>
              <Input
                id="template-subject"
                ref={subjectRef}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <TokenChips
                  tokens={template.tokens}
                  onInsert={insertIntoSubject}
                />
                <FieldPicker
                  tokens={template.tokens}
                  onSelect={insertIntoSubject}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Body</Label>
            <EmailBodyEditor
              value={body}
              onChange={setBody}
              tokens={template.tokens}
              forceHtml={isFragment}
            />
          </div>

          {problems.unknown.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {problems.unknown.length === 1
                  ? "This field is not available in this email"
                  : "These fields are not available in this email"}
                :{" "}
                <span className="font-mono">
                  {problems.unknown.map((t) => `{${t}}`).join(", ")}
                </span>
                . It will be sent exactly as written, braces and all. Use{" "}
                <strong>Insert field</strong> to pick one that exists here.
              </AlertDescription>
            </Alert>
          )}

          {problems.unclosed.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Unclosed optional block:{" "}
                <span className="font-mono">
                  {problems.unclosed.map((t) => `{#${t}}`).join(", ")}
                </span>
                . Every {"{#field}"} needs a matching {"{/field}"}.
              </AlertDescription>
            </Alert>
          )}

          {error !== null && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button onClick={save} disabled={saving || !dirty} className="gap-1.5">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save changes"}
            </Button>
            <Button
              variant="outline"
              onClick={sendTest}
              disabled={testing}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              {testing ? "Sending..." : "Send test to me"}
            </Button>
            <div className="sm:ml-auto sm:flex sm:gap-2">
              <Button
                variant="ghost"
                onClick={() => setHistoryOpen(true)}
                className="w-full gap-1.5 sm:w-auto"
              >
                <History className="h-4 w-4" />
                History
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirmRevert(true)}
                disabled={saving}
                className="w-full gap-1.5 sm:w-auto"
              >
                <RotateCcw className="h-4 w-4" />
                Revert to default
              </Button>
            </div>
          </div>

          {dirty && (
            <p className="text-xs text-muted-foreground">
              Unsaved changes. The preview and test send use what is on screen;
              real emails use the saved version.
            </p>
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <EmailPreview
            templateKey={template.key}
            subject={subject}
            body={body}
          />
        </TabsContent>
      </Tabs>

      <TemplateHistoryDialog
        templateKey={template.key}
        templateName={template.name}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onRestored={reloadAfterRestore}
      />

      <AlertDialog open={confirmRevert} onOpenChange={setConfirmRevert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert to the default wording?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces the current copy of &quot;{template.name}&quot; with
              the wording it shipped with. The current version stays in the
              history, so you can restore it afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={revert}>Revert</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
