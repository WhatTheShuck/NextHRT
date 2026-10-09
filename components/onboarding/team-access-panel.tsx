"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import api from "@/lib/axios";
import type { TeamMember } from "@/lib/services/accountOnboardingService";

const COLLAPSED_COUNT = 5;

/**
 * Dashboard panel for department managers: who in their team hasn't got onto
 * HRT yet, so they can chase them. Renders nothing for people who manage no
 * departments, or once everyone is linked.
 */
export function TeamAccessPanel() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .get<{ members: TeamMember[] | null }>("/api/team/account-status")
      .then((res) => setMembers(res.data.members))
      .catch(() => {});
  }, []);

  if (!members || members.length === 0) return null;

  const outstanding = members.filter((m) => m.state !== "linked");
  if (outstanding.length === 0) return null;

  const linkedCount = members.length - outstanding.length;
  const multipleDepartments = new Set(members.map((m) => m.department)).size > 1;
  const visible = showAll ? outstanding : outstanding.slice(0, COLLAPSED_COUNT);

  const copyInvite = async () => {
    const message =
      `Hi, please sign in to HRT at ${window.location.origin} using your ` +
      `work Microsoft account. It's where you'll find your training, tickets ` +
      `and SOPs.`;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to the clipboard");
    }
  };

  return (
    <Card data-tour="team-access">
      <CardHeader className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="h-5 w-5" aria-hidden />
              Your team on HRT
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {linkedCount} of {members.length} people in your team are set up.
              Anyone not signed in yet can&apos;t see their training or SOPs.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyInvite} className="shrink-0">
            {copied ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            {copied ? "Copied" : "Copy sign-in reminder"}
          </Button>
        </div>
        <Progress
          value={(linkedCount / members.length) * 100}
          aria-label={`${linkedCount} of ${members.length} set up`}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y rounded-lg border">
          {visible.map((m) => (
            <li
              key={m.employeeId}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <Link
                  href={`/employees/${m.employeeId}`}
                  className="font-medium hover:underline underline-offset-2"
                >
                  {m.name}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  {m.title}
                  {multipleDepartments && ` · ${m.department}`}
                </p>
              </div>
              {m.state === "awaitingLink" ? (
                <Badge variant="secondary" className="w-fit shrink-0">
                  Signed in — admin is linking
                </Badge>
              ) : (
                <Badge variant="outline" className="w-fit shrink-0">
                  Not signed in yet
                </Badge>
              )}
            </li>
          ))}
        </ul>
        {outstanding.length > COLLAPSED_COUNT && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${outstanding.length}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
