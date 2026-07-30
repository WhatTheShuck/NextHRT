"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/axios";
import {
  AlertTriangle,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { describeRequestError } from "./request-error";

interface PreviewResult {
  subject: string;
  body: string;
  unknownTokens: string[];
  unbalancedConditionals: string[];
}

/** Phone-width preview, close to the narrowest mail client worth designing for. */
const MOBILE_WIDTH = 390;

/**
 * Live preview of the draft, rendered by the server against sample data.
 *
 * Server-rendered deliberately: composing it in the browser would mean
 * reimplementing interpolation, the shared layout and row fragments, and any
 * drift between the two would show authors something recipients never get.
 *
 * The result is displayed in a sandboxed iframe with no `allow-scripts`, which
 * both neutralises any script in the template and stops the app's stylesheet
 * from leaking in — so the email is styled only by what it actually carries.
 */
export function EmailPreview({
  templateKey,
  subject,
  body,
}: {
  templateKey: string;
  subject: string;
  body: string;
}) {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  // Bumped by the retry button to re-run the effect with unchanged copy.
  const [attempt, setAttempt] = useState(0);

  // Tracks the newest request so a slow response can't overwrite a newer one.
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    // Debounced: the body changes on every keystroke and each render is a round
    // trip.
    const timer = setTimeout(async () => {
      try {
        setError(null);
        const res = await api.post<PreviewResult>(
          `/api/email-templates/${encodeURIComponent(templateKey)}/preview`,
          { subject, body },
        );
        if (id === requestId.current) {
          setResult(res.data);
          setLoading(false);
        }
      } catch (err) {
        if (id === requestId.current) {
          setError(describeRequestError(err, "render the preview"));
          setLoading(false);
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [templateKey, subject, body, attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  if (loading && result === null && error === null) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error !== null) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="space-y-2">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={retry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (result === null) return null;

  return (
    <div className="space-y-3">
      {result.unknownTokens.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">
              {result.unknownTokens.length === 1
                ? "This token is not available here"
                : "These tokens are not available here"}
              :
            </span>{" "}
            <span className="font-mono">
              {result.unknownTokens.map((t) => `{${t}}`).join(", ")}
            </span>
            . They will be sent literally, exactly as written. Check the spelling
            against the chips below the editor.
          </AlertDescription>
        </Alert>
      )}

      {result.unbalancedConditionals.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Unclosed optional block:{" "}
            <span className="font-mono">
              {result.unbalancedConditionals.map((t) => `{#${t}}`).join(", ")}
            </span>
            . Every {"{#token}"} needs a matching {"{/token}"}.
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-md border">
        <div className="flex items-start gap-2 border-b bg-muted/40 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">Subject</p>
            <p className="truncate text-sm font-medium">
              {result.subject || (
                <span className="text-muted-foreground">(no subject)</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <WidthButton
              label="Desktop width"
              icon={Monitor}
              active={width === "desktop"}
              onClick={() => setWidth("desktop")}
            />
            <WidthButton
              label="Phone width"
              icon={Smartphone}
              active={width === "mobile"}
              onClick={() => setWidth("mobile")}
            />
            <WidthButton
              label="Re-render preview"
              icon={RefreshCw}
              onClick={retry}
            />
          </div>
        </div>
        <div
          className={cn(
            "bg-muted/20",
            width === "mobile" && "flex justify-center px-2 py-3",
          )}
        >
          <iframe
            // No allow-scripts: the preview must never execute template content.
            sandbox=""
            title="Email preview"
            srcDoc={result.body}
            style={
              width === "mobile" ? { width: MOBILE_WIDTH, maxWidth: "100%" } : undefined
            }
            className={cn(
              "h-[28rem] bg-white",
              width === "mobile" ? "rounded border shadow-sm" : "w-full",
            )}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Rendered with sample data — real sends use the actual employee&apos;s
        details.
        {loading && (
          <Loader2 className="ml-1.5 inline h-3 w-3 animate-spin align-[-2px]" />
        )}
      </p>
    </div>
  );
}

function WidthButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      title={label}
      aria-label={label}
      aria-pressed={active}
      className="h-7 w-7 p-0"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
