"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { authClient } from "@/lib/auth-client";
import { CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApprovalAction {
  id: number;
  stage: string;
  decision: string;
  comment: string | null;
  onBehalfOf: boolean;
  createdAt: string;
  user: { id: string; name: string | null };
}

interface TrainingRequestDetail {
  id: number;
  justification: string | null;
  cost: number | null;
  hours: number | null;
  trainingDate: string | null;
  intendedCompletionDate: string | null;
  createdAt: string;
  employee: { id: number; legalFirstName: string; legalLastName: string };
  training: { id: number; title: string } | null;
  trainingCourseRequest: { id: number; name: string; status: string } | null;
  approvalRequest: {
    id: number;
    status: string;
    currentStage: string;
    submittedByUser: { id: string; name: string | null };
    nominatedApproverEmployee: { id: number; legalFirstName: string; legalLastName: string } | null;
    actions: ApprovalAction[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "Approved") return "default";
  if (status === "Rejected") return "destructive";
  return "secondary";
}

function stageLabel(stage: string): string {
  if (stage === "DepartmentManager") return "Department Manager";
  if (stage === "HRManager") return "HR Manager";
  return stage;
}

function decisionIcon(decision: string) {
  if (decision === "Approved") return <CheckCircle className="h-4 w-4 text-green-500" />;
  if (decision === "Rejected") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TrainingRequestStatusContent({ requestId }: { requestId: number }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [detail, setDetail] = useState<TrainingRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    api
      .get<TrainingRequestDetail>(`/api/training-requests/${requestId}`)
      .then((res) => setDetail(res.data))
      .catch(() => setError("Could not load training request."))
      .finally(() => setLoading(false));
  }, [requestId]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post(`/api/training-requests/${requestId}/cancel`);
      router.push("/forms");
    } catch {
      setError("Failed to cancel the request.");
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-background p-8">
        <p className="text-destructive">{error ?? "Request not found."}</p>
      </div>
    );
  }

  const isSubmitter = session?.user?.id === detail.approvalRequest.submittedByUser.id;
  const isPending = detail.approvalRequest.status === "Pending";
  const canCancel = isSubmitter && isPending;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Training Request #{detail.id}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Submitted {formatDate(detail.createdAt)} by{" "}
              {detail.approvalRequest.submittedByUser.name ?? "Unknown"}
            </p>
          </div>
          <Badge variant={statusBadgeVariant(detail.approvalRequest.status)}>
            {detail.approvalRequest.status}
          </Badge>
        </div>

        {/* Course request warning */}
        {detail.trainingCourseRequest && detail.trainingCourseRequest.status !== "Approved" && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
            <span>
              This request is linked to a pending course request (
              <strong>{detail.trainingCourseRequest.name}</strong>). It cannot be fully approved
              until an admin resolves the course request.
            </span>
          </div>
        )}

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-muted-foreground">Employee</span>
              <span>
                {detail.employee.legalFirstName} {detail.employee.legalLastName}
              </span>

              <span className="text-muted-foreground">Training</span>
              <span>
                {detail.training?.title ?? detail.trainingCourseRequest?.name ?? "—"}
                {detail.trainingCourseRequest && (
                  <span className="ml-2 text-xs text-muted-foreground">(course request)</span>
                )}
              </span>

              {detail.justification && (
                <>
                  <span className="text-muted-foreground">Justification</span>
                  <span>{detail.justification}</span>
                </>
              )}

              {detail.cost != null && (
                <>
                  <span className="text-muted-foreground">Estimated Cost</span>
                  <span>${detail.cost.toFixed(2)}</span>
                </>
              )}

              {detail.hours != null && (
                <>
                  <span className="text-muted-foreground">Duration</span>
                  <span>{detail.hours}h</span>
                </>
              )}

              {detail.trainingDate && (
                <>
                  <span className="text-muted-foreground">Training Date</span>
                  <span>{formatDate(detail.trainingDate)}</span>
                </>
              )}

              {detail.intendedCompletionDate && (
                <>
                  <span className="text-muted-foreground">Intended Completion</span>
                  <span>{formatDate(detail.intendedCompletionDate)}</span>
                </>
              )}

              {detail.approvalRequest.nominatedApproverEmployee && (
                <>
                  <span className="text-muted-foreground">Nominated Approver</span>
                  <span>
                    {detail.approvalRequest.nominatedApproverEmployee.legalFirstName}{" "}
                    {detail.approvalRequest.nominatedApproverEmployee.legalLastName}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Approval progress */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approval Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {/* Stage indicators */}
            <div className="flex items-center gap-2">
              {(["DepartmentManager", "HRManager", "Admin"] as const).map((stage, idx) => {
                const action = detail.approvalRequest.actions.find((a) => a.stage === stage);
                const isCurrent =
                  detail.approvalRequest.status === "Pending" &&
                  detail.approvalRequest.currentStage === stage;

                return (
                  <div key={stage} className="flex items-center gap-2">
                    {idx > 0 && <div className="h-px w-6 bg-border" />}
                    <div
                      className={`flex flex-col items-center gap-1 ${
                        isCurrent ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {action ? (
                        decisionIcon(action.decision)
                      ) : isCurrent ? (
                        <Clock className="h-4 w-4 text-primary" />
                      ) : (
                        <Clock className="h-4 w-4 opacity-30" />
                      )}
                      <span className="text-xs text-center w-20">{stageLabel(stage)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action log */}
            {detail.approvalRequest.actions.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  {detail.approvalRequest.actions.map((action) => (
                    <div key={action.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        {decisionIcon(action.decision)}
                        <span className="font-medium">
                          {action.user.name ?? "Unknown"}{" "}
                          {action.onBehalfOf && (
                            <span className="text-muted-foreground font-normal">(on behalf)</span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          — {stageLabel(action.stage)}
                        </span>
                        <span className="ml-auto text-muted-foreground text-xs">
                          {formatDate(action.createdAt)}
                        </span>
                      </div>
                      {action.comment && (
                        <p className="text-muted-foreground pl-6">{action.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {isPending && (
              <p className="text-muted-foreground text-xs">
                Awaiting {stageLabel(detail.approvalRequest.currentStage)} approval.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/forms")}>
            Back to Forms
          </Button>
          {canCancel && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={cancelling}>
                  {cancelling ? "Cancelling..." : "Cancel Request"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will withdraw the training request and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Request</AlertDialogCancel>
                  <AlertDialogAction onClick={handleCancel}>Yes, Cancel</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </div>
  );
}
