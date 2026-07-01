"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ExpiryNotificationSettingsProps {
  initialValue: boolean;
}

export function ExpiryNotificationSettings({
  initialValue,
}: ExpiryNotificationSettingsProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: boolean) {
    setSaving(true);
    const previous = enabled;
    setEnabled(next);
    try {
      const res = await fetch("/api/profile/expiry-notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receivesExpiryNotifications: next }),
      });
      if (!res.ok) setEnabled(previous); // revert on failure
    } catch {
      setEnabled(previous);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <Label htmlFor="expiry-notifications" className="text-sm font-medium">
          Receive ticket-expiry notifications
        </Label>
        <p className="text-sm text-muted-foreground">
          Get emailed when an employee&apos;s ticket is nearing expiry or has
          expired. Turn this off to stop receiving these emails.
        </p>
      </div>
      <Switch
        id="expiry-notifications"
        checked={enabled}
        disabled={saving}
        onCheckedChange={handleChange}
      />
    </div>
  );
}
