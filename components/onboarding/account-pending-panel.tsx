"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { contactDetails } from "@/lib/data";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Sign in",
    description: "You're signed in with your Microsoft account.",
  },
  {
    title: "Connect your employee record",
    description:
      "An administrator matches your sign-in to your employee record. They can already see you're waiting — there's nothing you need to do.",
  },
  {
    title: "Start using HRT",
    description:
      "See your training, tickets and SOPs, and submit forms and requests. We'll email you when it's ready.",
  },
] as const;

// Index of the step the person is waiting on.
const CURRENT_STEP = 1;

/** Shown on the dashboard while a signed-in account has no employee record. */
export function AccountPendingPanel({
  name,
  email,
  note,
}: {
  name: string | null;
  email: string | null;
  /** Extra context for the page the person tried to open, e.g. an emailed upload link. */
  note?: string;
}) {
  const router = useRouter();
  const [isChecking, startChecking] = useTransition();
  const firstName = name?.split(" ")[0];

  return (
    <Card className="max-w-3xl" data-tour="account-pending">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">
          Welcome{firstName ? `, ${firstName}` : ""} — your account is almost
          ready
        </CardTitle>
        <p className="text-muted-foreground">
          Before you can see your own records, your sign-in needs to be
          connected to your employee record. This is a one-off step.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {note && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            {note}
          </div>
        )}
        <ol className="space-y-4">
          {STEPS.map((step, i) => {
            const done = i < CURRENT_STEP;
            const current = i === CURRENT_STEP;
            const Icon = done ? CheckCircle2 : current ? Clock : Sparkles;
            return (
              <li key={step.title} className="flex gap-3">
                <Icon
                  className={cn(
                    "h-5 w-5 mt-0.5 shrink-0",
                    done && "text-primary",
                    current && "text-primary animate-pulse",
                    !done && !current && "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <div>
                  <p
                    className={cn(
                      "font-medium",
                      !done && !current && "text-muted-foreground",
                    )}
                  >
                    {step.title}
                    {done && <span className="sr-only"> (done)</span>}
                    {current && (
                      <span className="ml-2 text-xs font-normal rounded-full bg-primary/10 text-primary px-2 py-0.5">
                        In progress
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="rounded-lg bg-muted/50 border p-4 text-sm space-y-1">
          {email && (
            <p>
              Signed in as <span className="font-medium">{email}</span>
            </p>
          )}
          <p className="text-muted-foreground">
            Been waiting a while, or is this the wrong account? Contact{" "}
            {contactDetails.name} ({contactDetails.role}) at{" "}
            <a
              href={`mailto:${contactDetails.emailAdress}`}
              className="underline underline-offset-2"
            >
              {contactDetails.emailAdress}
            </a>
            .
          </p>
        </div>

        <Button
          variant="outline"
          data-tour="account-check-again"
          onClick={() => startChecking(() => router.refresh())}
          disabled={isChecking}
        >
          {isChecking ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Check again
        </Button>
      </CardContent>
    </Card>
  );
}
