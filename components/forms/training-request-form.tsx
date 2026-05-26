"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, ChevronsUpDown, Plus, Search, AlertTriangle } from "lucide-react";
import { useMediaQuery } from "usehooks-ts";
import { authClient } from "@/lib/auth-client";
import { TrainingCombobox } from "@/components/combobox/training-combobox";
import { EmployeeCombobox } from "@/components/combobox/employee-combobox";
import { DateSelector } from "@/components/date-selector";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Employee, Training } from "@/generated/prisma_client/client";

interface UserForApprover {
  id: string;
  name: string | null;
  employeeId: number | null;
  employee?: { id: number; firstName: string; lastName: string } | null;
}

function approverDisplayName(u: UserForApprover): string {
  if (u.employee) return `${u.employee.firstName} ${u.employee.lastName}`;
  return u.name ?? u.id;
}

interface SuggestedApproverListProps {
  approvers: UserForApprover[];
  selectedUserId: string | null;
  onSelect: (user: UserForApprover) => void;
}

function SuggestedApproverList({ approvers, selectedUserId, onSelect }: SuggestedApproverListProps) {
  return (
    <Command>
      <CommandInput placeholder="Search approvers..." className="h-9" />
      <CommandList>
        <CommandEmpty>No approvers found.</CommandEmpty>
        <CommandGroup>
          {approvers.map((user) => (
            <CommandItem
              key={user.id}
              value={approverDisplayName(user)}
              onSelect={() => onSelect(user)}
              className="cursor-pointer"
            >
              <Check
                className={`mr-2 h-4 w-4 ${
                  selectedUserId === user.id ? "opacity-100" : "opacity-0"
                }`}
              />
              <span className="font-medium">{approverDisplayName(user)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

// ─── Course Request Dialog ───────────────────────────────────────────────────

interface CourseRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: number, name: string) => void;
}

function CourseRequestDialogContent({
  onCreated,
  onClose,
}: {
  onCreated: (id: number, name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id: number; name: string }>("/api/training-course-requests", {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(res.data.id, res.data.name);
      onClose();
    } catch {
      setError("Failed to submit course request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="course-name">Course Name *</Label>
        <Input
          id="course-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Advanced Rigging Safety"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="course-desc">Description</Label>
        <Textarea
          id="course-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Why is this course needed?"
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !name.trim()}>
          {submitting ? "Submitting..." : "Submit Request"}
        </Button>
      </div>
    </form>
  );
}

function CourseRequestDialog({ open, onOpenChange, onCreated }: CourseRequestDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a New Training Course</DialogTitle>
          </DialogHeader>
          <CourseRequestDialogContent
            onCreated={onCreated}
            onClose={() => onOpenChange(false)}
          />
          <DialogFooter />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Request a New Training Course</DrawerTitle>
        </DrawerHeader>
        <CourseRequestDialogContent
          onCreated={onCreated}
          onClose={() => onOpenChange(false)}
        />
        <DrawerFooter />
      </DrawerContent>
    </Drawer>
  );
}

// ─── Main Form ───────────────────────────────────────────────────────────────

interface TrainingRequestFormProps {
  onSuccess?: () => void;
}

export function TrainingRequestForm({ onSuccess }: TrainingRequestFormProps) {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  // --- Employee ---
  const [ownEmployee, setOwnEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployeeDeptId, setSelectedEmployeeDeptId] = useState<number | null>(null);
  const [isOnBehalf, setIsOnBehalf] = useState(false);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);

  // --- Training ---
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string | null>(null);
  const [selectedCourseRequestId, setSelectedCourseRequestId] = useState<number | null>(null);
  const [selectedCourseRequestName, setSelectedCourseRequestName] = useState<string | null>(null);

  // --- Fields ---
  const [justification, setJustification] = useState("");
  const [cost, setCost] = useState("");
  const [hours, setHours] = useState("");

  // --- Suggested approver ---
  const [approverMode, setApproverMode] = useState<"suggested" | "override">("suggested");
  const [suggestedApprovers, setSuggestedApprovers] = useState<UserForApprover[]>([]);
  const [selectedApproverUserId, setSelectedApproverUserId] = useState<string | null>(null);
  const [selectedApproverEmployeeId, setSelectedApproverEmployeeId] = useState<number | null>(null);
  const [approverOpen, setApproverOpen] = useState(false);

  // --- Override approver (employee picker) ---
  const [overrideApproverEmployeeId, setOverrideApproverEmployeeId] = useState<string | null>(null);
  const [overrideApproverHasUser, setOverrideApproverHasUser] = useState<boolean | null>(null);
  const [allUsers, setAllUsers] = useState<UserForApprover[]>([]);

  const isDesktop = useMediaQuery("(min-width: 768px)");

  // --- Dates ---
  const [trainingDate, setTrainingDate] = useState<Date>(new Date());
  const [intendedCompletionDate, setIntendedCompletionDate] = useState<Date>(new Date());

  // --- Course request dialog ---
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);

  // --- UI ---
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load current user's linked employee and trainings on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchInitial = async () => {
      setIsLoading(true);
      try {
        const [userRes, trainingsRes] = await Promise.all([
          api.get(`/api/users/${session.user.id}`),
          api.get<Training[]>("/api/training?activeOnly=true"),
        ]);
        setTrainings(trainingsRes.data);
        const linkedEmployee = userRes.data?.employee as Employee | null;
        if (linkedEmployee) {
          setOwnEmployee(linkedEmployee);
          setSelectedEmployeeId(linkedEmployee.id.toString());
          setSelectedEmployeeDeptId(linkedEmployee.departmentId);
        }
      } catch (err) {
        console.error("Error loading form data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitial();
  }, [session?.user?.id]);

  // Load all employees when "on behalf" is ticked (lazy, load once).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isOnBehalf || allEmployees.length > 0) return;
    api
      .get<Employee[]>("/api/employees?activeOnly=true")
      .then((res) => setAllEmployees(res.data))
      .catch((err) => console.error("Error loading employees:", err));
  }, [isOnBehalf, allEmployees.length]);

  // Load suggested approvers when the selected employee's department changes
  useEffect(() => {
    if (!selectedEmployeeDeptId) {
      setSuggestedApprovers([]);
      return;
    }
    api
      .get<UserForApprover[]>(`/api/departments/${selectedEmployeeDeptId}/managers`)
      .then((res) => setSuggestedApprovers(res.data))
      .catch((err) => console.error("Error loading managers:", err));
  }, [selectedEmployeeDeptId]);

  // Load all users when override mode is activated (lazy, load once) — used for
  // the "no user account" warning check.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (approverMode !== "override" || allUsers.length > 0) return;
    api
      .get<UserForApprover[]>("/api/users?includeEmployee=true")
      .then((res) => setAllUsers(res.data))
      .catch((err) => console.error("Error loading users:", err));
  }, [approverMode, allUsers.length]);

  // Load all employees when override mode is activated (needed for the employee picker).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (approverMode !== "override" || allEmployees.length > 0) return;
    api
      .get<Employee[]>("/api/employees?activeOnly=true")
      .then((res) => setAllEmployees(res.data))
      .catch((err) => console.error("Error loading employees:", err));
  }, [approverMode, allEmployees.length]);

  // Check if the override-selected employee has a linked user account
  useEffect(() => {
    if (!overrideApproverEmployeeId || allUsers.length === 0) {
      setOverrideApproverHasUser(null);
      return;
    }
    const empId = Number(overrideApproverEmployeeId);
    setOverrideApproverHasUser(allUsers.some((u) => u.employeeId === empId));
  }, [overrideApproverEmployeeId, allUsers]);

  const handleEmployeeSelect = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    const emp = allEmployees.find((e) => e.id.toString() === employeeId);
    if (emp) {
      setSelectedEmployeeDeptId(emp.departmentId);
    } else {
      setSelectedEmployeeDeptId(null);
    }
    // Reset approver when employee changes
    setSelectedApproverUserId(null);
    setSelectedApproverEmployeeId(null);
    setOverrideApproverEmployeeId(null);
    setApproverMode("suggested");
  };

  const handleSuggestedApproverSelect = (user: UserForApprover) => {
    setSelectedApproverUserId(user.id);
    setSelectedApproverEmployeeId(user.employeeId ?? null);
    setApproverOpen(false);
  };

  const handleOverrideApproverSelect = (employeeId: string) => {
    setOverrideApproverEmployeeId(employeeId);
    setSelectedApproverEmployeeId(Number(employeeId));
  };

  const handleSwitchToOverride = () => {
    setApproverMode("override");
    setSelectedApproverUserId(null);
    setSelectedApproverEmployeeId(null);
    setOverrideApproverEmployeeId(null);
    setOverrideApproverHasUser(null);
  };

  const handleSwitchToSuggested = () => {
    setApproverMode("suggested");
    setSelectedApproverUserId(null);
    setSelectedApproverEmployeeId(null);
    setOverrideApproverEmployeeId(null);
    setOverrideApproverHasUser(null);
  };

  const handleCourseRequestCreated = (id: number, name: string) => {
    setSelectedCourseRequestId(id);
    setSelectedCourseRequestName(name);
    setSelectedTrainingId(null); // course request replaces training selection
  };

  const selectedSuggestedApprover = suggestedApprovers.find(
    (u) => u.id === selectedApproverUserId,
  );

  const SuggestedApproverCombobox = () => {
    const trigger = (
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={approverOpen}
        className="w-full justify-between"
        type="button"
      >
        {selectedSuggestedApprover ? (
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            {approverDisplayName(selectedSuggestedApprover)}
          </span>
        ) : (
          <span className="text-muted-foreground flex items-center gap-2">
            <Search className="h-4 w-4" />
            {suggestedApprovers.length === 0
              ? "No managers found for this department"
              : "Select an approver..."}
          </span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );

    if (isDesktop) {
      return (
        <Popover open={approverOpen} onOpenChange={setApproverOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            className="p-0"
            style={{ width: "var(--radix-popover-trigger-width)" }}
            onWheel={(e) => e.stopPropagation()}
          >
            <SuggestedApproverList
              approvers={suggestedApprovers}
              selectedUserId={selectedApproverUserId}
              onSelect={handleSuggestedApproverSelect}
            />
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <Drawer open={approverOpen} onOpenChange={setApproverOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[90vh]">
          <DrawerTitle className="px-4 text-left">Select Approver</DrawerTitle>
          <SuggestedApproverList
            approvers={suggestedApprovers}
            selectedUserId={selectedApproverUserId}
            onSelect={handleSuggestedApproverSelect}
          />
        </DrawerContent>
      </Drawer>
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployeeId) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post<{
        trainingRequest: { id: number };
        approvalRequest: { id: number };
      }>(
        "/api/training-requests",
        {
          employeeId: Number(selectedEmployeeId),
          trainingId: selectedTrainingId ? Number(selectedTrainingId) : undefined,
          trainingCourseRequestId: selectedCourseRequestId ?? undefined,
          nominatedApproverEmployeeId: selectedApproverEmployeeId ?? undefined,
          justification: justification.trim() || undefined,
          cost: cost ? Number(cost) : undefined,
          hours: hours ? Number(hours) : undefined,
          trainingDate: trainingDate.toISOString(),
          intendedCompletionDate: intendedCompletionDate.toISOString(),
        },
      );

      if (onSuccess) {
        onSuccess();
      } else {
        router.push(`/forms/training-request/${res.data.trainingRequest.id}`);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit request. Please try again.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="pt-6 text-muted-foreground">Loading...</div>;
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 pt-6">
        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        {/* Employee */}
        <div className="space-y-3">
          <Label>Employee *</Label>
          <EmployeeCombobox
            employees={isOnBehalf ? allEmployees : ownEmployee ? [ownEmployee] : []}
            selectedEmployeeId={selectedEmployeeId}
            onSelect={isOnBehalf ? handleEmployeeSelect : () => {}}
            disabled={!isOnBehalf}
            placeholder={
              isOnBehalf ? "Search and select an employee..." : "No employee linked to your account"
            }
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="isOnBehalf"
              checked={isOnBehalf}
              onCheckedChange={(checked) => {
                setIsOnBehalf(!!checked);
                if (!checked && ownEmployee) {
                  setSelectedEmployeeId(ownEmployee.id.toString());
                  setSelectedEmployeeDeptId(ownEmployee.departmentId);
                  setSelectedApproverUserId(null);
                  setSelectedApproverEmployeeId(null);
                  setOverrideApproverEmployeeId(null);
                  setApproverMode("suggested");
                }
              }}
            />
            <Label htmlFor="isOnBehalf" className="cursor-pointer font-normal">
              Submit on behalf of someone else
            </Label>
          </div>
        </div>

        {/* Training Course */}
        <div className="space-y-2">
          <Label>Training Course *</Label>
          {selectedCourseRequestId ? (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
                <span className="text-muted-foreground">Pending course request:</span>
                <span className="font-medium">{selectedCourseRequestName}</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedCourseRequestId(null);
                  setSelectedCourseRequestName(null);
                }}
              >
                Clear
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1">
                <TrainingCombobox
                  trainings={trainings}
                  selectedTrainingId={selectedTrainingId}
                  onSelect={setSelectedTrainingId}
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => setCourseDialogOpen(true)}
                title="Request a new training course"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Justification */}
        <div className="space-y-2">
          <Label htmlFor="justification">Justification *</Label>
          <Input
            id="justification"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Brief reason for attending this training"
            required
          />
        </div>

        {/* Cost */}
        <div className="space-y-2">
          <Label htmlFor="cost">Estimated Cost ($) *</Label>
          <Input
            id="cost"
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            onBlur={() => {
              const parsed = parseFloat(cost);
              if (!isNaN(parsed)) setCost(parsed.toFixed(2));
            }}
            placeholder="0.00"
            required
          />
        </div>

        {/* Hours */}
        <div className="space-y-2">
          <Label htmlFor="hours">Duration (Hours) *</Label>
          <Input
            id="hours"
            type="number"
            step="0.5"
            min="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="e.g. 8"
            required
          />
        </div>

        {/* Approver */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Approver</Label>
            {approverMode === "suggested" ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={handleSwitchToOverride}
              >
                Choose a different approver
              </Button>
            ) : (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={handleSwitchToSuggested}
              >
                Back to suggested approvers
              </Button>
            )}
          </div>

          {approverMode === "suggested" ? (
            <>
              <p className="text-xs text-muted-foreground">
                Showing department managers for the selected employee&apos;s department.
              </p>
              <SuggestedApproverCombobox />
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Select any employee to nominate as approver. Any department manager can still
                approve on their behalf.
              </p>
              <EmployeeCombobox
                employees={allEmployees}
                selectedEmployeeId={overrideApproverEmployeeId}
                onSelect={handleOverrideApproverSelect}
                placeholder="Search and select an approver..."
              />
              {overrideApproverHasUser === false && overrideApproverEmployeeId && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This employee does not have a user account. Any department manager can
                    approve on their behalf instead.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        {/* Training Date */}
        <div className="space-y-2">
          <Label>Training Date</Label>
          <DateSelector selectedDate={trainingDate} onDateSelect={setTrainingDate} />
        </div>

        {/* Intended Completion Date */}
        <div className="space-y-2">
          <Label>Intended Completion Date</Label>
          <DateSelector
            selectedDate={intendedCompletionDate}
            onDateSelect={setIntendedCompletionDate}
          />
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={
            isSubmitting ||
            !selectedEmployeeId ||
            (!selectedTrainingId && !selectedCourseRequestId)
          }
        >
          {isSubmitting ? "Submitting..." : "Submit Request"}
        </Button>
      </form>

      <CourseRequestDialog
        open={courseDialogOpen}
        onOpenChange={setCourseDialogOpen}
        onCreated={handleCourseRequestCreated}
      />
    </>
  );
}
