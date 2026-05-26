"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingApproval {
  id: number; // approvalRequest.id
  status: string;
  currentStage: string;
  createdAt: string;
  nominatedApproverEmployee: { id: number; firstName: string; lastName: string } | null;
  submittedByUser: { id: string; name: string | null };
  actions: {
    id: number;
    stage: string;
    decision: string;
    comment: string | null;
    onBehalfOf: boolean;
    createdAt: string;
    user: { id: string; name: string | null };
  }[];
  trainingRequest: {
    id: number;
    justification: string | null;
    cost: number | null;
    hours: number | null;
    trainingDate: string | null;
    employee: { id: number; firstName: string; lastName: string };
    training: { id: number; title: string } | null;
    trainingCourseRequest: { id: number; name: string } | null;
  } | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stageLabel(stage: string): string {
  if (stage === "DepartmentManager") return "Department Manager";
  if (stage === "HRManager") return "HR Manager";
  return stage;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Approval Card ────────────────────────────────────────────────────────────

function ApprovalCard({
  approval,
  onDecisionRecorded,
}: {
  approval: PendingApproval;
  onDecisionRecorded: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [decision, setDecision] = useState<"Approved" | "Rejected" | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tr = approval.trainingRequest;
  const trainingName = tr?.training?.title ?? tr?.trainingCourseRequest?.name ?? "Unknown";
  const employeeName = tr
    ? `${tr.employee.firstName} ${tr.employee.lastName}`
    : "Unknown";

  const courseRequestPending = !!tr?.trainingCourseRequest;

  const handleSubmit = async () => {
    if (!decision || !tr) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/api/training-requests/${tr.id}/decision`, { decision, comment: comment.trim() || undefined });
      onDecisionRecorded();
    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const r = (err as { response?: { data?: { error?: string } } }).response;
        setError(r?.data?.error ?? "Failed to submit decision.");
      } else {
        setError("Failed to submit decision.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="flex items-start justify-between gap-4 text-base font-medium">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span>{employeeName}</span>
              <span className="text-muted-foreground font-normal">—</span>
              <span>{trainingName}</span>
              {courseRequestPending && (
                <Badge variant="outline" className="text-xs">pending course</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground font-normal">
              Stage: {stageLabel(approval.currentStage)} · Submitted{" "}
              {formatDate(approval.createdAt)} by {approval.submittedByUser.name ?? "Unknown"}
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 mt-1 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 mt-1 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 text-sm">
          {/* Details */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {tr?.justification && (
              <>
                <span className="text-muted-foreground">Justification</span>
                <span>{tr.justification}</span>
              </>
            )}
            {tr?.cost != null && (
              <>
                <span className="text-muted-foreground">Est. Cost</span>
                <span>${tr.cost.toFixed(2)}</span>
              </>
            )}
            {tr?.hours != null && (
              <>
                <span className="text-muted-foreground">Duration</span>
                <span>{tr.hours}h</span>
              </>
            )}
            {tr?.trainingDate && (
              <>
                <span className="text-muted-foreground">Training Date</span>
                <span>{formatDate(tr.trainingDate)}</span>
              </>
            )}
            {approval.nominatedApproverEmployee && (
              <>
                <span className="text-muted-foreground">Nominated Approver</span>
                <span>
                  {approval.nominatedApproverEmployee.firstName}{" "}
                  {approval.nominatedApproverEmployee.lastName}
                </span>
              </>
            )}
          </div>

          {/* Prior actions */}
          {approval.actions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  History
                </p>
                {approval.actions.map((a) => (
                  <div key={a.id} className="flex items-start gap-2">
                    {a.decision === "Approved" ? (
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div>
                      <span className="font-medium">{a.user.name ?? "Unknown"}</span>
                      {a.onBehalfOf && (
                        <span className="text-muted-foreground ml-1">(on behalf)</span>
                      )}
                      <span className="text-muted-foreground ml-1">
                        — {stageLabel(a.stage)} · {formatDate(a.createdAt)}
                      </span>
                      {a.comment && <p className="text-muted-foreground">{a.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Course request warning */}
          {courseRequestPending && decision === "Approved" && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This request is linked to a pending course request. Approving will advance the
                stage, but the final Admin approval will be blocked until the course request is
                resolved.
              </AlertDescription>
            </Alert>
          )}

          {/* Decision form */}
          <Separator />
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Your Decision
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={decision === "Approved" ? "default" : "outline"}
                onClick={() => setDecision("Approved")}
                className="flex items-center gap-1"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
              <Button
                type="button"
                size="sm"
                variant={decision === "Rejected" ? "destructive" : "outline"}
                onClick={() => setDecision("Rejected")}
                className="flex items-center gap-1"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`comment-${approval.id}`} className="text-xs">
                Comment{decision === "Rejected" ? " *" : ""}
                {approval.nominatedApproverEmployee ? " * (required — acting on behalf)" : ""}
              </Label>
              <Textarea
                id={`comment-${approval.id}`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Optional comment..."
                rows={2}
              />
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <Button
              size="sm"
              disabled={!decision || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Submitting..." : "Submit Decision"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Page Content ─────────────────────────────────────────────────────────────

export function ApprovalsPageContent() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchApprovals = () => {
    setLoading(true);
    api
      .get<PendingApproval[]>("/api/approvals/pending")
      .then((res) => setApprovals(res.data))
      .catch(() => setError("Failed to load pending approvals."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  const handleDecisionRecorded = () => {
    fetchApprovals();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Training requests waiting for your review.
          </p>
        </div>

        {loading && <p className="text-muted-foreground">Loading...</p>}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && !error && approvals.length === 0 && (
          <p className="text-muted-foreground">No pending approvals.</p>
        )}

        {approvals.map((a) => (
          <ApprovalCard key={a.id} approval={a} onDecisionRecorded={handleDecisionRecorded} />
        ))}
      </div>
    </div>
  );
}
