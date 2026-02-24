"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useEmployee } from "../employee-context";
import { useSession } from "@/lib/auth-client";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LinkIcon,
  Link2Off,
  ChevronsUpDown,
  Check,
  RefreshCw,
  Mail,
  Shield,
  User2,
} from "lucide-react";
import type { UserCandidateForEmployee } from "@/lib/services/matchingService";
import { User } from "@/generated/prisma_client";

type LinkedUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
};

export function UserLinkTab() {
  const { employee, employeeId } = useEmployee();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "Admin";

  const [linkedUser, setLinkedUser] = useState<LinkedUser | null | undefined>(
    undefined,
  ); // undefined = not yet loaded
  const [suggestions, setSuggestions] = useState<UserCandidateForEmployee[]>(
    [],
  );
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [comboOpen, setComboOpen] = useState(false);

  // Fetch users list and find the one linked to this employee
  const fetchLinkedUser = useCallback(async () => {
    try {
      setLoadingUser(true);
      setError(null);
      const res = await api.get<User[]>("/api/users?includeEmployee=true");
      const linked =
        res.data.find((u) => u.employeeId === employeeId) ?? null;
      setLinkedUser(
        linked
          ? {
              id: linked.id,
              name: linked.name,
              email: linked.email,
              role: linked.role,
            }
          : null,
      );
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 401)
          setError("You are not authenticated.");
        else if (err.response?.status === 403)
          setError("You do not have permission to view this.");
        else setError("Failed to load user link information.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoadingUser(false);
    }
  }, [employeeId]);

  const fetchSuggestions = useCallback(async () => {
    try {
      setLoadingSuggestions(true);
      const res = await api.get<UserCandidateForEmployee[]>(
        `/api/suggestions/user-employee?employeeId=${employeeId}`,
      );
      setSuggestions(res.data);
    } catch {
      // best-effort; don't block the UI
    } finally {
      setLoadingSuggestions(false);
    }
  }, [employeeId]);

  const openLinkDialog = async () => {
    setSelectedUserId(null);
    setShowLinkDialog(true);
    try {
      setLoadingUsers(true);
      const res = await api.get<User[]>("/api/users");
      // Only show unlinked users as candidates
      setAllUsers(res.data.filter((u) => u.employeeId === null));
    } catch {
      // fail silently; combobox will show empty
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchLinkedUser();
    else setLoadingUser(false);
  }, [isAdmin, fetchLinkedUser]);

  // Once we know the employee isn't linked, load suggestions
  useEffect(() => {
    if (!loadingUser && linkedUser === null && isAdmin) {
      fetchSuggestions();
    }
  }, [loadingUser, linkedUser, isAdmin, fetchSuggestions]);

  const handleLink = async (userId: string) => {
    try {
      setLinking(true);
      setError(null);
      // If currently linked to a different user, remove that link first
      if (linkedUser && linkedUser.id !== userId) {
        await api.delete(`/api/users/${linkedUser.id}/employee`);
      }
      await api.put(`/api/users/${userId}/employee`, { employeeId });
      await fetchLinkedUser();
      setSuggestions([]);
      setShowLinkDialog(false);
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 409)
          setError("That user is already linked to another employee.");
        else setError("Failed to link user.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!linkedUser) return;
    try {
      setUnlinking(true);
      setError(null);
      await api.delete(`/api/users/${linkedUser.id}/employee`);
      setLinkedUser(null);
      fetchSuggestions();
    } catch (err) {
      if (err instanceof AxiosError) {
        setError("Failed to remove link.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setUnlinking(false);
    }
  };

  if (!employee) return null;

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            Admin access is required to view user account linkage.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loadingUser) {
    return <div className="flex justify-center my-8">Loading...</div>;
  }

  if (error && linkedUser === undefined) {
    return (
      <div className="flex flex-col items-center justify-center my-8 p-4 border border-red-200 rounded-md bg-red-50">
        <p className="text-red-600 mb-2">{error}</p>
        <Button variant="outline" onClick={fetchLinkedUser}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 border border-red-200 rounded-md bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Linked User Card */}
      <Card>
        <CardHeader>
          <CardTitle>Linked User Account</CardTitle>
          <CardDescription>
            The system user account associated with this employee record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkedUser ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Name</span>
                  <span className="ml-auto font-medium">
                    {linkedUser.name || "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Email</span>
                  <span className="ml-auto">{linkedUser.email || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Role</span>
                  <Badge variant="outline" className="ml-auto">
                    {linkedUser.role || "User"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openLinkDialog}
                  disabled={unlinking}
                >
                  <LinkIcon className="h-4 w-4 mr-1" />
                  Change Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlink}
                  disabled={unlinking}
                  className="text-destructive border-destructive hover:bg-destructive/10"
                >
                  <Link2Off className="h-4 w-4 mr-1" />
                  {unlinking ? "Removing..." : "Remove Link"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No user account is linked to this employee record.
              </p>
              <Button variant="outline" size="sm" onClick={openLinkDialog}>
                <LinkIcon className="h-4 w-4 mr-1" />
                Link Manually
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suggestions section — only shown when unlinked */}
      {!linkedUser && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Suggested User Accounts</CardTitle>
                <CardDescription>
                  Unlinked users that may correspond to this employee, ranked by
                  confidence.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchSuggestions}
                disabled={loadingSuggestions}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loadingSuggestions ? (
              <div className="flex justify-center my-4 text-sm text-muted-foreground">
                Loading suggestions...
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Strategies</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suggestions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-4 text-sm text-muted-foreground"
                        >
                          No suggestions found above the confidence threshold
                        </TableCell>
                      </TableRow>
                    ) : (
                      suggestions.map((candidate) => (
                        <TableRow key={candidate.user.id}>
                          <TableCell>
                            <div className="font-medium">
                              {candidate.user.name || "—"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {candidate.user.email || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <ScoreBadge score={candidate.score} />
                          </TableCell>
                          <TableCell>
                            <BreakdownBadges breakdown={candidate.breakdown} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleLink(candidate.user.id)}
                              disabled={linking}
                            >
                              <LinkIcon className="h-4 w-4 mr-1" />
                              Link
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Link / Change Link Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {linkedUser ? "Change Linked User" : "Link User Account"}
            </DialogTitle>
            <DialogDescription>
              {linkedUser
                ? `Select a replacement for ${employee.firstName} ${employee.lastName}. The current link will be removed first.`
                : `Select a user account to link to ${employee.firstName} ${employee.lastName}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">User</label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between"
                  >
                    {selectedUserId
                      ? (allUsers.find((u) => u.id === selectedUserId)?.name ??
                        allUsers.find((u) => u.id === selectedUserId)?.email ??
                        "Unknown")
                      : "Select a user..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="p-0"
                  align="start"
                  style={{ width: "var(--radix-popover-trigger-width)" }}
                >
                  <Command>
                    <CommandInput
                      placeholder="Search users..."
                      className="h-9"
                    />
                    <CommandList className="max-h-[200px] overflow-y-auto">
                      <CommandEmpty>No unlinked users found.</CommandEmpty>
                      <CommandGroup>
                        {loadingUsers ? (
                          <CommandItem disabled>Loading...</CommandItem>
                        ) : (
                          allUsers.map((user) => (
                            <CommandItem
                              key={user.id}
                              value={`${user.name} ${user.email}`}
                              onSelect={() => {
                                setSelectedUserId(user.id);
                                setComboOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  selectedUserId === user.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                }`}
                              />
                              <div className="flex flex-col">
                                <span>{user.name || "—"}</span>
                                <span className="text-sm text-muted-foreground">
                                  {user.email || "—"}
                                </span>
                              </div>
                            </CommandItem>
                          ))
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLinkDialog(false)}
              disabled={linking}
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedUserId && handleLink(selectedUserId)}
              disabled={!selectedUserId || linking}
            >
              {linking ? "Linking..." : "Save Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const rounded = Math.round(score);
  const variant =
    rounded >= 90 ? "default" : rounded >= 60 ? "secondary" : "outline";
  return <Badge variant={variant}>{rounded}%</Badge>;
}

function BreakdownBadges({
  breakdown,
}: {
  breakdown: UserCandidateForEmployee["breakdown"];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {breakdown.email !== undefined && (
        <Badge
          variant={breakdown.email.score > 0 ? "default" : "outline"}
          className="text-xs"
        >
          Email {breakdown.email.score > 0 ? "✓" : "–"}
        </Badge>
      )}
      {breakdown.nameExact !== undefined && (
        <Badge
          variant={breakdown.nameExact.score > 0 ? "default" : "outline"}
          className="text-xs"
        >
          Name {breakdown.nameExact.score > 0 ? "✓" : "–"}
        </Badge>
      )}
      {breakdown.nameFuzzy !== undefined && (
        <Badge
          variant={breakdown.nameFuzzy.score > 0 ? "default" : "outline"}
          className="text-xs"
        >
          Fuzzy{" "}
          {breakdown.nameFuzzy.score > 0
            ? `~${Math.round(breakdown.nameFuzzy.similarity * 100)}%`
            : "–"}
        </Badge>
      )}
    </div>
  );
}
