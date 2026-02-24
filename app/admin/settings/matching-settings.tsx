"use client";

import { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { useSession } from "@/lib/auth-client";

type Settings = Record<string, string>;

// Apply the email template to a local part and return the extracted tokens,
// or null if the template doesn't match.
function previewEmailTemplate(
  template: string,
  localPart: string,
): { firstName: string; lastName: string } | null {
  try {
    const firstPos = template.indexOf("{firstName}");
    const lastPos = template.indexOf("{lastName}");
    if (firstPos === -1 || lastPos === -1) return null;

    const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, (c) => {
      if (c === "{" || c === "}") return c;
      return "\\" + c;
    });
    const pattern = escaped
      .replace(/\{firstName\}/g, "([a-z]+)")
      .replace(/\{lastName\}/g, "([a-z]+)");
    const regex = new RegExp(`^${pattern}$`, "i");
    const match = localPart.match(regex);
    if (!match) return null;

    const firstIndex = firstPos < lastPos ? 1 : 2;
    const lastIndex = firstPos < lastPos ? 2 : 1;
    return { firstName: match[firstIndex], lastName: match[lastIndex] };
  } catch {
    return null;
  }
}

export function MatchingSettings() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<Settings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const userEmail = session?.user?.email ?? null;
  const userName = session?.user?.name ?? null;
  const userLocalPart = userEmail ? userEmail.split("@")[0] : null;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<Settings>("/api/settings");
        setSettings(res.data);
      } catch (err) {
        if (err instanceof AxiosError) {
          setError(
            err.response?.status === 403
              ? "You do not have permission to view settings."
              : "Failed to load settings.",
          );
        } else {
          setError("An unexpected error occurred.");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const set = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
      }));
      await api.put("/api/settings", { updates });
      setSaved(true);
    } catch (err) {
      if (err instanceof AxiosError) {
        setError(
          err.response?.status === 403
            ? "You do not have permission to update settings."
            : "Failed to save settings.",
        );
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground py-6">Loading settings...</div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Email Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email Strategy</CardTitle>
          <CardDescription>
            Match users to employees by parsing the email local part using a
            template.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-enabled">Enable email matching</Label>
            <Switch
              id="email-enabled"
              checked={settings["matching.email.enabled"] !== "false"}
              onCheckedChange={(checked) =>
                set("matching.email.enabled", checked ? "true" : "false")
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-template">Email template</Label>
            <Input
              id="email-template"
              value={settings["matching.email.template"] ?? ""}
              onChange={(e) => set("matching.email.template", e.target.value)}
              placeholder="{firstName}.{lastName}"
              disabled={settings["matching.email.enabled"] === "false"}
            />
            <EmailTemplateHint
              template={settings["matching.email.template"] ?? ""}
              localPart={userLocalPart}
              userEmail={userEmail}
            />
          </div>
        </CardContent>
      </Card>

      {/* Name Exact Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name Exact Strategy</CardTitle>
          <CardDescription>
            Match when the user&apos;s display name exactly equals the
            employee&apos;s full name in either order.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="name-exact-enabled">
              Enable exact name matching
            </Label>
            <Switch
              id="name-exact-enabled"
              checked={settings["matching.nameExact.enabled"] !== "false"}
              onCheckedChange={(checked) =>
                set("matching.nameExact.enabled", checked ? "true" : "false")
              }
            />
          </div>
          <NameExactHint userName={userName} />
        </CardContent>
      </Card>

      {/* Name Fuzzy Strategy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Name Fuzzy Strategy</CardTitle>
          <CardDescription>
            Match using Levenshtein similarity between the user&apos;s display
            name and the employee&apos;s full name.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="name-fuzzy-enabled">Enable fuzzy matching</Label>
            <Switch
              id="name-fuzzy-enabled"
              checked={settings["matching.nameFuzzy.enabled"] !== "false"}
              onCheckedChange={(checked) =>
                set("matching.nameFuzzy.enabled", checked ? "true" : "false")
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuzzy-threshold">
              Similarity threshold (0.0 – 1.0)
            </Label>
            <Input
              id="fuzzy-threshold"
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={settings["matching.nameFuzzy.threshold"] ?? "0.7"}
              onChange={(e) =>
                set("matching.nameFuzzy.threshold", e.target.value)
              }
              className="w-32"
              disabled={settings["matching.nameFuzzy.enabled"] === "false"}
            />
            <NameFuzzyHint userName={userName} />
          </div>
        </CardContent>
      </Card>

      {/* Global */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Global Settings</CardTitle>
          <CardDescription>
            Settings that apply across all matching strategies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="suggestion-threshold">
            Suggestion score threshold (0 – 100)
          </Label>
          <Input
            id="suggestion-threshold"
            type="number"
            min="0"
            max="100"
            step="5"
            value={settings["matching.suggestionThreshold"] ?? "50"}
            onChange={(e) =>
              set("matching.suggestionThreshold", e.target.value)
            }
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Candidate pairs with a combined score below this value will be
            hidden from the suggestions list.
          </p>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        {saved && (
          <span className="text-sm text-green-600">Settings saved.</span>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}

// --- Hint sub-components ---

// Try to infer a working template from the email by detecting the separator
// between two word-like segments, e.g. "brandon.wiedman" → "{firstName}.{lastName}".
function suggestTemplate(localPart: string): string | null {
  const match = localPart.match(/^([a-z]+)([^a-z]+)([a-z]+)$/i);
  if (!match) return null;
  const sep = match[2];
  return `{firstName}${sep}{lastName}`;
}

function EmailTemplateHint({
  template,
  localPart,
  userEmail,
}: {
  template: string;
  localPart: string | null;
  userEmail: string | null;
}) {
  if (!localPart || !userEmail) {
    return (
      <p className="text-xs text-muted-foreground">
        Use <code className="font-mono">{"{firstName}"}</code> and{" "}
        <code className="font-mono">{"{lastName}"}</code> tokens to describe how
        your email addresses are structured before the @.
      </p>
    );
  }

  const parsed = template ? previewEmailTemplate(template, localPart) : null;

  if (!parsed) {
    const suggestion = suggestTemplate(localPart);
    return (
      <p className="text-xs text-muted-foreground">
        This template doesn&apos;t match your email{" "}
        <code className="font-mono">{userEmail}</code>.
        {suggestion && suggestion !== template ? (
          <>
            {" "}Based on your email format, try{" "}
            <code className="font-mono">{suggestion}</code>.
          </>
        ) : (
          <>
            {" "}Check that the separator and token order reflect how your
            organisation&apos;s email addresses are structured.
          </>
        )}
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      Your email <code className="font-mono">{userEmail}</code> would match an
      employee with first name{" "}
      <code className="font-mono">{parsed.firstName}</code> and last name{" "}
      <code className="font-mono">{parsed.lastName}</code>.
    </p>
  );
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function NameExactHint({ userName }: { userName: string | null }) {
  if (!userName) {
    return (
      <p className="text-xs text-muted-foreground">
        Checks both <em>First Last</em> and <em>Last First</em> orderings.
        Punctuation (e.g. commas in &quot;Smith, Jane&quot;) is ignored before
        comparing.
      </p>
    );
  }

  const normalized = normalizeName(userName);
  const parts = normalized.split(" ");
  const reversed =
    parts.length >= 2 ? `${parts.slice(1).join(" ")} ${parts[0]}` : normalized;

  const showNormalized = normalized !== userName.toLowerCase().trim();

  return (
    <p className="text-xs text-muted-foreground">
      Your display name <code className="font-mono">{userName}</code>
      {showNormalized && (
        <>
          {" "}(normalised to{" "}
          <code className="font-mono">{normalized}</code>)
        </>
      )}{" "}
      would match an employee named{" "}
      <code className="font-mono">{normalized}</code> or{" "}
      <code className="font-mono">{reversed}</code>.
    </p>
  );
}

function NameFuzzyHint({ userName }: { userName: string | null }) {
  if (!userName) {
    return (
      <p className="text-xs text-muted-foreground">
        Pairs with similarity at or above this value are considered matches.
        Higher values require closer spelling. Recommended:{" "}
        <code className="font-mono">0.7</code>.
      </p>
    );
  }

  return (
    <p className="text-xs text-muted-foreground">
      Your display name <code className="font-mono">{userName}</code> will be
      compared against each employee&apos;s full name. Higher thresholds require
      closer spelling. Recommended: <code className="font-mono">0.7</code>.
    </p>
  );
}
