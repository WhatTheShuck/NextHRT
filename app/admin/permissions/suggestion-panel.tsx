"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LinkIcon, ChevronDown, ChevronRight, RefreshCw, Search } from "lucide-react";
import api from "@/lib/axios";
import { AxiosError } from "axios";
import type { UserMatchSuggestion } from "@/lib/services/matchingService";

export function SuggestionPanel() {
  const [suggestions, setSuggestions] = useState<UserMatchSuggestion[]>([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState<UserMatchSuggestion[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null); // "userId:employeeId"
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<UserMatchSuggestion[]>(
        "/api/suggestions/user-employee",
      );
      setSuggestions(res.data);
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 401) {
          setError("You are not authenticated. Please log in.");
        } else if (err.response?.status === 403) {
          setError("You do not have permission to view suggestions.");
        } else {
          setError("Failed to load suggestions. Please try again.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredSuggestions(suggestions);
      return;
    }
    const lower = searchTerm.toLowerCase();
    setFilteredSuggestions(
      suggestions.filter(
        (s) =>
          s.user.name?.toLowerCase().includes(lower) ||
          s.user.email?.toLowerCase().includes(lower),
      ),
    );
  }, [searchTerm, suggestions]);

  const handleLink = async (userId: string, employeeId: number) => {
    const key = `${userId}:${employeeId}`;
    try {
      setLinking(key);
      await api.put(`/api/users/${userId}/employee`, { employeeId });
      setSuggestions((prev) => prev.filter((s) => s.user.id !== userId));
      setFilteredSuggestions((prev) => prev.filter((s) => s.user.id !== userId));
    } catch (err) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 409) {
          setError("That employee is already linked to another user.");
        } else {
          setError("Failed to link user to employee.");
        }
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setLinking(null);
    }
  };

  const toggleExpanded = (userId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  if (loading && suggestions.length === 0) {
    return <div className="flex justify-center my-8">Loading suggestions...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center my-8 p-4 border border-red-200 rounded-md bg-red-50">
        <p className="text-red-600 mb-2">Error: {error}</p>
        <Button variant="outline" onClick={fetchSuggestions}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center space-x-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by name or email"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSuggestions}
          disabled={loading}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>User</TableHead>
              <TableHead>Top Candidate</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Strategies</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSuggestions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  {searchTerm
                    ? "No suggestions found matching your search"
                    : "No suggestions — all users are linked or no matches found above threshold"}
                </TableCell>
              </TableRow>
            ) : filteredSuggestions.map((suggestion) => {
              const top = suggestion.candidates[0];
              const isExpanded = expanded.has(suggestion.user.id);
              const hasMore = suggestion.candidates.length > 1;

              return (
                <React.Fragment key={suggestion.user.id}>
                  <TableRow>
                    <TableCell>
                      {hasMore && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => toggleExpanded(suggestion.user.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {suggestion.user.name || "—"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {suggestion.user.email || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {top.employee.firstName} {top.employee.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {top.employee.department} · {top.employee.location}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ScoreBadge score={top.score} />
                    </TableCell>
                    <TableCell>
                      <BreakdownBadges breakdown={top.breakdown} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() =>
                          handleLink(suggestion.user.id, top.employee.id)
                        }
                        disabled={
                          linking === `${suggestion.user.id}:${top.employee.id}`
                        }
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        Link
                      </Button>
                    </TableCell>
                  </TableRow>

                  {isExpanded &&
                    suggestion.candidates.slice(1).map((candidate) => (
                      <TableRow
                        key={`${suggestion.user.id}-${candidate.employee.id}`}
                        className="bg-muted/30"
                      >
                        <TableCell />
                        <TableCell />
                        <TableCell>
                          <div className="font-medium">
                            {candidate.employee.firstName}{" "}
                            {candidate.employee.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {candidate.employee.department} ·{" "}
                            {candidate.employee.location}
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
                            variant="outline"
                            onClick={() =>
                              handleLink(
                                suggestion.user.id,
                                candidate.employee.id,
                              )
                            }
                            disabled={
                              linking ===
                              `${suggestion.user.id}:${candidate.employee.id}`
                            }
                          >
                            <LinkIcon className="h-4 w-4 mr-1" />
                            Link
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </React.Fragment>
              );
            })}
          </TableBody>

        </Table>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const rounded = Math.round(score);
  const variant =
    rounded >= 90
      ? "default"
      : rounded >= 60
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{rounded}%</Badge>;
}

function BreakdownBadges({
  breakdown,
}: {
  breakdown: UserMatchSuggestion["candidates"][number]["breakdown"];
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
