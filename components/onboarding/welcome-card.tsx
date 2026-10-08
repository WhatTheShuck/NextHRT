"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  ChevronRight,
  ClipboardList,
  IdCard,
  ListCheck,
  PartyPopper,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/axios";

/**
 * One-time welcome shown after an admin links the account to an employee
 * record. Dismissal is stored server-side so it doesn't come back on another
 * device, and only reappears if the account is linked afresh.
 */
export function WelcomeCard({
  firstName,
  title,
  department,
  employeeId,
}: {
  firstName: string;
  title: string;
  department: string;
  employeeId: number;
}) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    // Best-effort: worst case it shows once more on the next visit.
    api.delete("/api/profile/welcome").catch(() => {});
  };

  const startHere = [
    {
      href: `/employees/${employeeId}`,
      icon: IdCard,
      label: "Check your details",
      hint: "Your training, tickets and personal details",
    },
    {
      href: "/my-sops",
      icon: BookOpenCheck,
      label: "My SOPs",
      hint: "Read SOPs and complete assessments",
    },
    {
      href: "/quiz",
      icon: ClipboardList,
      label: "My Questionnaires",
      hint: "Anything you've been asked to complete",
    },
    {
      href: "/forms",
      icon: ListCheck,
      label: "Forms",
      hint: "Request training and more",
    },
  ];

  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-xl">
            <PartyPopper className="h-5 w-5 text-primary" aria-hidden />
            You&apos;re all set, {firstName}!
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Your account is now connected to your employee record ({title},{" "}
            {department}). Here&apos;s a good place to start:
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="Dismiss welcome"
          className="shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {startHere.map(({ href, icon: Icon, label, hint }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-3 rounded-lg border bg-background p-3 hover:border-primary transition-colors"
            >
              <Icon className="h-5 w-5 mt-0.5 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium flex items-center gap-1">
                  {label}
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Something not right in your details? Let your manager or HR know.{" "}
          <button
            type="button"
            onClick={dismiss}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Got it, hide this
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
