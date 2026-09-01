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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { X } from "lucide-react";
import api from "@/lib/axios";
import { AxiosError } from "axios";

const SETTING_KEY = "tickets.expiryReminderDays";
const MAX_DAYS = 3650;

// Mirrors the handler's parser so the UI shows exactly what will be used.
function parseMilestones(raw: string): number[] {
  const parsed = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(parsed)].sort((a, b) => b - a);
}

export function TicketExpirySettings() {
  const [milestones, setMilestones] = useState<number[]>([]);
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get<Record<string, string>>("/api/settings");
        setMilestones(parseMilestones(res.data[SETTING_KEY] ?? ""));
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

  const remove = (days: number) => {
    setMilestones((prev) => prev.filter((d) => d !== days));
    setSaved(false);
    setError(null);
  };

  const add = () => {
    const days = Number(newValue.trim());
    if (!Number.isInteger(days) || days <= 0) {
      setError("Enter a whole number of days greater than zero.");
      return;
    }
    if (days > MAX_DAYS) {
      setError(`Reminders cannot be set more than ${MAX_DAYS} days ahead.`);
      return;
    }
    if (milestones.includes(days)) {
      setError(`A ${days}-day reminder already exists.`);
      return;
    }
    setMilestones((prev) => [...prev, days].sort((a, b) => b - a));
    setNewValue("");
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    // An empty list would silently fall back to the built-in defaults, which
    // is not what "I removed them all" means to an admin.
    if (milestones.length === 0) {
      setError("Keep at least one reminder milestone.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await api.put("/api/settings", {
        updates: [{ key: SETTING_KEY, value: milestones.join(",") }],
      });
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
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ticket Expiry Reminders</CardTitle>
        <CardDescription>
          A renewal reminder email is sent once at each milestone below. The
          largest value also sets how far ahead expiries are looked at — nothing
          expiring beyond it is reported at all.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Reminder milestones</Label>
          {milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No milestones — add at least one before saving.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {milestones.map((days) => (
                <Badge
                  key={days}
                  variant="secondary"
                  className="gap-1 py-1 pl-3 pr-1 text-sm"
                >
                  {days} day{days === 1 ? "" : "s"} before
                  <button
                    type="button"
                    onClick={() => remove(days)}
                    aria-label={`Remove the ${days}-day reminder`}
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="new-milestone">Add a milestone (days)</Label>
            <Input
              id="new-milestone"
              type="number"
              min={1}
              max={MAX_DAYS}
              inputMode="numeric"
              placeholder="e.g. 14"
              className="w-40"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
            />
          </div>
          <Button type="button" variant="outline" onClick={add}>
            Add
          </Button>
        </div>

        <Separator />

        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {saved && (
            <span className="text-sm text-green-600">Settings saved.</span>
          )}
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
