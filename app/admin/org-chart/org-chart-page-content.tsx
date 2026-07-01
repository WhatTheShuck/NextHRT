"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import api from "@/lib/axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoveDepartmentDialog } from "@/components/dialogs/employee/move-department-dialog";
import {
  RefreshCw,
  Users,
  Building2,
  AlertTriangle,
  UserX,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  UserCheck,
  Search,
  FolderInput,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrgEmployee {
  id: number;
  legalFirstName: string;
  legalLastName: string;
  preferredFirstName: string | null;
  preferredLastName: string | null;
  title: string;
  status: string;
  isActive: boolean;
  location: { name: string; state: string };
  User: { id: string; name: string | null; email: string | null; role: string | null } | null;
}

interface OrgManager {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  canManageChildrenDepartments: boolean;
}

interface OrgDepartment {
  id: number;
  name: string;
  isActive: boolean;
  level: number;
  parentDepartmentId: number | null;
  managers: OrgManager[];
  employees: OrgEmployee[];
  childDepartments: OrgDepartment[];
}

interface UnlinkedUser {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
}

interface OrgStats {
  totalDepartments: number;
  totalEmployees: number;
  linkedEmployees: number;
  unlinkedEmployees: number;
  unlinkedUsers: number;
  departmentsWithoutManagers: number;
  emptyDepartments: number;
}

interface OrgChartData {
  departments: OrgDepartment[];
  unlinkedUsers: UnlinkedUser[];
  stats: OrgStats;
}

interface FlatDepartment {
  id: number;
  name: string;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface OrgChartContextValue {
  allDepartments: FlatDepartment[];
  onRefresh: () => void;
}

const OrgChartContext = createContext<OrgChartContextValue>({
  allDepartments: [],
  onRefresh: () => {},
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  Permanent: "Permanent",
  Apprentice: "Apprentice",
  LabourContractor: "Contractor",
  IndustryExperience: "Ind. Exp.",
  PartTimePermanent: "Part-Time",
};

const ROLE_LABELS: Record<string, string> = {
  Admin: "Admin",
  DepartmentManager: "Dept. Manager",
  FireWarden: "Fire Warden",
  User: "User",
};

function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Permanent" || status === "PartTimePermanent") return "secondary";
  if (status === "Apprentice") return "default";
  return "outline";
}

function deptHasIssues(
  dept: OrgDepartment,
  activeOnly: boolean,
  parentHasCoveringManager = false,
): boolean {
  const employees = activeOnly ? dept.employees.filter((e) => e.isActive) : dept.employees;
  if (!parentHasCoveringManager && dept.managers.length === 0) return true;
  if (employees.some((e) => !e.User)) return true;
  const coversChildren = dept.managers.some((m) => m.canManageChildrenDepartments);
  for (const child of dept.childDepartments) {
    if (deptHasIssues(child, activeOnly, coversChildren)) return true;
  }
  return false;
}

function deptMatchesSearch(dept: OrgDepartment, q: string): boolean {
  const lower = q.toLowerCase();
  if (dept.name.toLowerCase().includes(lower)) return true;
  if (dept.managers.some((m) => m.name?.toLowerCase().includes(lower) || m.email?.toLowerCase().includes(lower))) return true;
  if (dept.employees.some((e) =>
    `${e.legalFirstName} ${e.legalLastName} ${e.preferredFirstName ?? ""} ${e.preferredLastName ?? ""}`.toLowerCase().includes(lower) ||
    e.title.toLowerCase().includes(lower) ||
    e.User?.name?.toLowerCase().includes(lower) ||
    e.User?.email?.toLowerCase().includes(lower)
  )) return true;
  if (dept.childDepartments.some((c) => deptMatchesSearch(c, q))) return true;
  return false;
}

// ─── Employee Row ─────────────────────────────────────────────────────────────

function EmployeeRow({ emp, currentDeptId }: { emp: OrgEmployee; currentDeptId: number }) {
  const { allDepartments, onRefresh } = useContext(OrgChartContext);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="group flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0">
                {emp.User ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-500" />
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {emp.User ? `Linked to ${emp.User.email ?? emp.User.name}` : "No user account linked"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <div className="min-w-0">
          <span className="font-medium text-sm">{emp.legalFirstName} {emp.legalLastName}</span>
          <span className="text-xs text-muted-foreground ml-1.5">{emp.title}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {!emp.isActive && (
          <Badge variant="destructive" className="text-xs py-0">Inactive</Badge>
        )}
        <Badge variant={statusVariant(emp.status)} className="text-xs py-0 hidden sm:inline-flex">
          {STATUS_LABELS[emp.status] ?? emp.status}
        </Badge>
        {emp.User?.role && emp.User.role !== "User" && (
          <Badge variant="secondary" className="text-xs py-0 hidden md:inline-flex">
            {ROLE_LABELS[emp.User.role] ?? emp.User.role}
          </Badge>
        )}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setDialogOpen(true)}
              >
                <FolderInput className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Move to another department</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <MoveDepartmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employeeId={emp.id}
        employeeName={`${emp.legalFirstName} ${emp.legalLastName}`}
        currentDeptId={currentDeptId}
        departments={allDepartments}
        onMoved={onRefresh}
      />
    </div>
  );
}

// ─── Manager Row ──────────────────────────────────────────────────────────────

function ManagerRow({ managers, covered }: { managers: OrgManager[]; covered: boolean }) {
  if (managers.length === 0) {
    if (covered) {
      return (
        <p className="text-xs text-muted-foreground flex items-center gap-1 px-2 py-1">
          <UserCheck className="h-3.5 w-3.5 shrink-0" />
          Covered by parent department manager
        </p>
      );
    }
    return (
      <p className="text-xs text-amber-600 flex items-center gap-1 px-2 py-1">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
        No manager assigned
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 py-1">
      <UserCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">Managed by:</span>
      {managers.map((m) => (
        <TooltipProvider key={m.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="text-xs cursor-default">
                {m.name ?? m.email}
                {m.canManageChildrenDepartments && " *"}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{m.email}</p>
              {m.canManageChildrenDepartments && (
                <p className="text-muted-foreground">* Covers child departments</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

// ─── Child Department Section ────────────────────────────────────────────────

function ChildDepartmentSection({
  dept,
  activeOnly,
  parentHasCoveringManager,
}: {
  dept: OrgDepartment;
  activeOnly: boolean;
  parentHasCoveringManager: boolean;
}) {
  const [open, setOpen] = useState(true);
  const employees = activeOnly ? dept.employees.filter((e) => e.isActive) : dept.employees;
  const noManagerCoverage = dept.managers.length === 0 && !parentHasCoveringManager;
  const unlinkedCount = employees.filter((e) => !e.User).length;
  const hasIssues = noManagerCoverage || unlinkedCount > 0;

  return (
    <div className="border-l-2 border-muted pl-3 ml-1">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors text-left">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold truncate">{dept.name}</span>
          {!dept.isActive && (
            <Badge variant="outline" className="text-xs py-0 text-muted-foreground">Inactive</Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {hasIssues && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {noManagerCoverage && <p>No manager assigned</p>}
                    {unlinkedCount > 0 && (
                      <p>{unlinkedCount} employee{unlinkedCount > 1 ? "s" : ""} without user accounts</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {employees.length}
            </Badge>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="pl-4 pb-1 space-y-0.5">
            <ManagerRow managers={dept.managers} covered={parentHasCoveringManager} />
            {employees.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">No employees</p>
            ) : (
              employees.map((emp) => <EmployeeRow key={emp.id} emp={emp} currentDeptId={dept.id} />)
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ─── Root Department Card ─────────────────────────────────────────────────────

function DepartmentCard({ dept, activeOnly }: { dept: OrgDepartment; activeOnly: boolean }) {
  const [open, setOpen] = useState(true);
  const employees = activeOnly ? dept.employees.filter((e) => e.isActive) : dept.employees;
  const hasIssues = deptHasIssues(dept, activeOnly);
  const coversChildren = dept.managers.some((m) => m.canManageChildrenDepartments);
  const unlinkedCount = employees.filter((e) => !e.User).length;
  const noManager = dept.managers.length === 0;

  return (
    <Card className={`h-fit ${hasIssues ? "border-amber-300 dark:border-amber-700" : ""}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full flex items-center gap-2 py-3 px-4 rounded-t-lg hover:bg-muted/50 transition-colors text-left">
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="font-bold truncate">{dept.name}</span>
          {!dept.isActive && (
            <Badge variant="outline" className="text-xs py-0 text-muted-foreground">Inactive</Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {hasIssues && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {noManager && <p>No manager assigned</p>}
                    {unlinkedCount > 0 && (
                      <p>{unlinkedCount} employee{unlinkedCount > 1 ? "s" : ""} without user accounts</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Badge variant="secondary" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {employees.length + dept.childDepartments.reduce(
                (sum, c) => sum + (activeOnly ? c.employees.filter((e) => e.isActive).length : c.employees.length),
                0,
              )}
            </Badge>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-1 space-y-1">
            <ManagerRow managers={dept.managers} covered={false} />
            {employees.length > 0 && (
              <div className="space-y-0">
                {employees.map((emp) => <EmployeeRow key={emp.id} emp={emp} currentDeptId={dept.id} />)}
              </div>
            )}
            {employees.length === 0 && dept.childDepartments.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">No employees</p>
            )}
            {dept.childDepartments.length > 0 && (
              <div className="space-y-1 pt-1">
                {dept.childDepartments.map((child) => (
                  <ChildDepartmentSection
                    key={child.id}
                    dept={child}
                    activeOnly={activeOnly}
                    parentHasCoveringManager={coversChildren}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, warn, icon }: {
  label: string;
  value: number;
  warn?: boolean;
  icon: React.ReactNode;
}) {
  return (
    <Card className={warn && value > 0 ? "border-amber-300 dark:border-amber-700" : ""}>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`p-2 rounded-md ${warn && value > 0 ? "bg-amber-100 dark:bg-amber-900/30" : "bg-muted"}`}>
          {icon}
        </div>
        <div>
          <p className={`text-2xl font-bold ${warn && value > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function OrgChartPageContent() {
  const [data, setData] = useState<OrgChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(true);
  const [issuesOnly, setIssuesOnly] = useState(false);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    api
      .get<OrgChartData>("/api/org-chart")
      .then((res) => setData(res.data))
      .catch(() => setError("Failed to load org chart data."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const allDepartments = useMemo<FlatDepartment[]>(() => {
    if (!data) return [];
    const flat: FlatDepartment[] = [];
    for (const dept of data.departments) {
      flat.push({ id: dept.id, name: dept.name });
      for (const child of dept.childDepartments) {
        flat.push({ id: child.id, name: child.name });
      }
    }
    return flat.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const filteredDepts = useMemo(() => {
    if (!data) return [];
    return data.departments.filter((dept) => {
      if (activeOnly && !dept.isActive) return false;
      if (issuesOnly && !deptHasIssues(dept, activeOnly)) return false;
      if (search && !deptMatchesSearch(dept, search)) return false;
      return true;
    });
  }, [data, activeOnly, issuesOnly, search]);

  const filteredUnlinkedUsers = useMemo(() => {
    if (!data) return [];
    if (!search) return data.unlinkedUsers;
    const lower = search.toLowerCase();
    return data.unlinkedUsers.filter(
      (u) => u.name?.toLowerCase().includes(lower) || u.email?.toLowerCase().includes(lower)
    );
  }, [data, search]);

  const anyManagerCoversChildren = useMemo(
    () => data?.departments.some((d) => d.managers.some((m) => m.canManageChildrenDepartments)) ?? false,
    [data],
  );

  return (
    <OrgChartContext.Provider value={{ allDepartments, onRefresh: fetchData }}>
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Org Chart</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Department hierarchy and employee account linkage
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Departments"
              value={data.stats.totalDepartments}
              icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              label="Total Employees"
              value={data.stats.totalEmployees}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              label="Unlinked Employees"
              value={data.stats.unlinkedEmployees}
              warn
              icon={<XCircle className="h-4 w-4 text-amber-500" />}
            />
            <StatCard
              label="Depts Without Managers"
              value={data.stats.departmentsWithoutManagers}
              warn
              icon={<ShieldAlert className="h-4 w-4 text-amber-500" />}
            />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search departments, employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="active-only" checked={activeOnly} onCheckedChange={setActiveOnly} />
            <Label htmlFor="active-only" className="cursor-pointer text-sm">Active only</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="issues-only" checked={issuesOnly} onCheckedChange={setIssuesOnly} />
            <Label htmlFor="issues-only" className="cursor-pointer text-sm">Issues only</Label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="h-48 animate-pulse bg-muted" />
            ))}
          </div>
        )}

        {/* Legend */}
        {data && !loading && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Linked user account
            </span>
            <span className="flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-amber-500" /> No user account
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Department has issues
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" /> No manager assigned
            </span>
            <span className="flex items-center gap-1.5">
              <FolderInput className="h-3.5 w-3.5" /> Hover employee to move department
            </span>
            {anyManagerCoversChildren && (
              <span className="flex items-center gap-1.5">
                <span className="font-mono font-bold">*</span> Manager covers child departments
              </span>
            )}
          </div>
        )}

        {/* Org chart */}
        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredDepts.map((dept) => (
              <DepartmentCard key={dept.id} dept={dept} activeOnly={activeOnly} />
            ))}
            {filteredDepts.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-8">
                No departments match the current filters.
              </p>
            )}
          </div>
        )}

        {/* Unlinked users */}
        {data && filteredUnlinkedUsers.length > 0 && (
          <Card className="border-amber-300 dark:border-amber-700">
            <CardContent className="px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <UserX className="h-5 w-5 text-amber-500" />
                <span className="font-semibold">
                  Unlinked User Accounts ({filteredUnlinkedUsers.length})
                </span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    </TooltipTrigger>
                    <TooltipContent>These users have no employee record linked</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                {filteredUnlinkedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <UserX className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{u.name ?? u.email}</p>
                      {u.name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                    </div>
                    {u.role && u.role !== "User" && (
                      <Badge variant="secondary" className="text-xs ml-auto shrink-0">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </OrgChartContext.Provider>
  );
}
