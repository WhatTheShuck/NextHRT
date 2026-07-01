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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/lib/axios";
import { AxiosError } from "axios";

interface Training {
  id: number;
  title: string;
}

export function TrainingDeliverSettings() {
  const [allTrainings, setAllTrainings] = useState<Training[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [trainingsRes, settingsRes] = await Promise.all([
          api.get<Training[]>("/api/training?activeOnly=true"),
          api.get<Record<string, string>>("/api/settings"),
        ]);
        setAllTrainings(trainingsRes.data);
        const raw = settingsRes.data["internallyDeliveredTrainingIds"] ?? "[]";
        const ids: number[] = JSON.parse(raw);
        setSelectedIds(new Set(ids));
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

  const toggle = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await api.put("/api/settings", {
        updates: [
          {
            key: "internallyDeliveredTrainingIds",
            value: JSON.stringify(Array.from(selectedIds)),
          },
        ],
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

  const filtered = allTrainings.filter((t) =>
    t.title.toLowerCase().includes(filter.toLowerCase()),
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-80" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Training I Deliver</CardTitle>
        <CardDescription>
          Select the training courses you personally deliver. Only these courses
          appear on the Required Training tracker.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="Filter trainings..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />

        {allTrainings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active training courses found.
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No trainings match your filter.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {filtered.map((training) => (
              <div key={training.id} className="flex items-center gap-2">
                <Checkbox
                  id={`training-${training.id}`}
                  checked={selectedIds.has(training.id)}
                  onCheckedChange={() => toggle(training.id)}
                />
                <Label
                  htmlFor={`training-${training.id}`}
                  className="cursor-pointer font-normal"
                >
                  {training.title}
                </Label>
              </div>
            ))}
          </div>
        )}

        <Separator />

        <div className="flex items-center gap-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
          {saved && (
            <span className="text-sm text-green-600">Settings saved.</span>
          )}
          {error && (
            <span className="text-sm text-destructive">{error}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
