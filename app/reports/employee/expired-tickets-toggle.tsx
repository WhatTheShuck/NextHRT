"use client";

import { CalendarX } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

/**
 * Expired tickets are hidden by default on the ticket reports — an expired
 * ticket says nothing about what the employee currently holds.
 */
export function ExpiredTicketsToggle({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="expired-tickets"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
      <Label htmlFor="expired-tickets" className="flex items-center gap-2">
        <CalendarX className="h-4 w-4" />
        Include expired tickets
      </Label>
    </div>
  );
}
