"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaQuery } from "usehooks-ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import api from "@/lib/axios";
import { AxiosError } from "axios";

type Settings = Record<string, string>;

interface EmailTemplate {
  id: number;
  key: string;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
}

// Scalar settings surfaced on this tab. Base URLs + recipients (§6.7).
const CONFIG_FIELDS: { key: string; label: string; description: string }[] = [
  {
    key: "onboarding.itTicketBaseUrl",
    label: "IT ticket base URL",
    description:
      "A program's ticket number is appended to this to build the IT service-offering link.",
  },
  {
    key: "onboarding.hardwareEndpoint",
    label: "Hardware request endpoint",
    description: "Endpoint for the hardware-request platform (placeholder).",
  },
  {
    key: "onboarding.recipient.marketing",
    label: "Marketing induction recipient",
    description: "Email address that receives marketing-induction bookings.",
  },
  {
    key: "onboarding.recipient.medical",
    label: "Medical contact recipient",
    description: "Email address for pre-employment medical contacts.",
  },
  {
    key: "onboarding.recipient.licence",
    label: "Driver-licence recipient",
    description: "Who receives driver-licence copies (currently 'Vicki').",
  },
];

const ATTACHMENT_SLOTS: { slot: string; label: string }[] = [
  { slot: "employmentForms", label: "Employment forms" },
  { slot: "policeCheck", label: "Police check form" },
];

export function OnboardingSettings() {
  const [settings, setSettings] = useState<Settings>({});
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<EmailTemplate | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [settingsRes, templatesRes] = await Promise.all([
        api.get<Settings>("/api/settings"),
        api.get<EmailTemplate[]>("/api/email-templates"),
      ]);
      setSettings(settingsRes.data);
      setTemplates(templatesRes.data);
    } catch (err) {
      setError(
        err instanceof AxiosError && err.response?.status === 403
          ? "You do not have permission to view onboarding settings."
          : "Failed to load onboarding settings.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      const updates = CONFIG_FIELDS.map((f) => ({
        key: f.key,
        value: settings[f.key] ?? "",
      }));
      await api.put("/api/settings", { updates });
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof AxiosError && err.response?.status === 403
          ? "You do not have permission to update settings."
          : "Failed to save settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-80" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Scalar config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">URLs &amp; recipients</CardTitle>
          <CardDescription>
            Base URLs and email recipients used by onboarding job fan-out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {CONFIG_FIELDS.map((f) => (
            <div key={f.key} className="space-y-2">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input
                id={f.key}
                value={settings[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{f.description}</p>
            </div>
          ))}
          <div className="flex items-center gap-4 pt-2">
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? "Saving..." : "Save config"}
            </Button>
            {saved && (
              <span className="text-sm text-green-600">Settings saved.</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email templates</CardTitle>
          <CardDescription>
            Edit the copy sent by onboarding jobs. Use {"{tokens}"} to
            interpolate values such as {"{preferredFirstName}"}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.key}
              className="flex items-center justify-between gap-4 rounded-md border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {t.key}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(t)}
              >
                Edit
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Compliance attachments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance attachments</CardTitle>
          <CardDescription>
            Upload the employment-forms pack and police-check form attached to
            onboarding emails. PDF or image, max 5MB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ATTACHMENT_SLOTS.map((a) => (
            <AttachmentRow
              key={a.slot}
              slot={a.slot}
              label={a.label}
              currentPath={settings[`onboarding.attachment.${a.slot}`] ?? ""}
              onChanged={load}
            />
          ))}
        </CardContent>
      </Card>

      {error && (
        <>
          <Separator />
          <span className="text-sm text-destructive">{error}</span>
        </>
      )}

      <TemplateEditor
        template={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setTemplates((prev) =>
            prev.map((t) => (t.key === updated.key ? updated : t)),
          );
          setEditing(null);
        }}
      />
    </div>
  );
}

function AttachmentRow({
  slot,
  label,
  currentPath,
  onChanged,
}: {
  slot: string;
  label: string;
  currentPath: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    try {
      setBusy(true);
      setError(null);
      const formData = new FormData();
      formData.append("slot", slot);
      formData.append("file", file);
      await api.post("/api/onboarding-config/attachments", formData);
      onChanged();
    } catch (err) {
      setError(
        err instanceof AxiosError
          ? err.response?.data?.error ?? "Upload failed."
          : "Upload failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    try {
      setBusy(true);
      setError(null);
      await api.delete(`/api/onboarding-config/attachments/${slot}`);
      onChanged();
    } catch {
      setError("Failed to remove attachment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-4">
        <Label>{label}</Label>
        {currentPath ? (
          <div className="flex items-center gap-2">
            <a
              href={`/api/onboarding-config/attachments/${slot}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary underline"
            >
              View current
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={busy}
            >
              Remove
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">None uploaded</span>
        )}
      </div>
      <Input
        type="file"
        accept="application/pdf,image/*"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: EmailTemplate | null;
  onClose: () => void;
  onSaved: (t: EmailTemplate) => void;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const open = template !== null;

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit email template</DialogTitle>
            <DialogDescription>{template?.key}</DialogDescription>
          </DialogHeader>
          {template && (
            <TemplateForm
              template={template}
              onSaved={onSaved}
              onCancel={onClose}
            />
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Edit email template</DrawerTitle>
          <DrawerDescription>{template?.key}</DrawerDescription>
        </DrawerHeader>
        {template && (
          <TemplateForm
            className="px-4 pb-4 overflow-y-auto"
            template={template}
            onSaved={onSaved}
            onCancel={onClose}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function TemplateForm({
  template,
  onSaved,
  onCancel,
  className,
}: {
  template: EmailTemplate;
  onSaved: (t: EmailTemplate) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await api.put<EmailTemplate>(
        `/api/email-templates/${encodeURIComponent(template.key)}`,
        { subject, body },
      );
      onSaved(res.data);
    } catch (err) {
      setError(
        err instanceof AxiosError && err.response?.status === 403
          ? "You do not have permission to edit templates."
          : "Failed to save template.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tmpl-subject">Subject</Label>
          <Input
            id="tmpl-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tmpl-body">Body</Label>
          <Textarea
            id="tmpl-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col space-y-2 w-full md:flex-row-reverse md:gap-2 md:space-y-0 md:justify-start">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save template"}
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
