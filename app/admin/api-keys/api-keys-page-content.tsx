"use client";

import { useState, useEffect, useCallback } from "react";
import { useMediaQuery } from "usehooks-ts";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Key, Plus, Trash2, Copy, Check } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ApiKey {
  id: string;
  name: string | null;
  start: string | null;
  prefix: string | null;
  createdAt: Date | string;
  expiresAt: Date | string | null;
  enabled: boolean;
}

const EXPIRY_OPTIONS = [
  { label: "Never", value: "never" },
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "90 days", value: "90" },
  { label: "1 year", value: "365" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isExpired(expiresAt: Date | string | null): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

// ─── Create form (shared between dialog & drawer) ────────────────────────────

interface CreateFormProps {
  onCreated: (key: string) => void;
  onClose: () => void;
  className?: string;
}

function CreateForm({ onCreated, onClose, className }: CreateFormProps) {
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState("never");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Please enter a name for this key.");
      return;
    }
    setCreating(true);
    setError(null);

    const expiresIn =
      expiry === "never" ? undefined : parseInt(expiry) * 24 * 60 * 60;

    const { data, error: apiError } = await authClient.apiKey.create({
      name: name.trim(),
      expiresIn,
    });

    setCreating(false);

    if (apiError || !data) {
      setError(apiError?.message ?? "Failed to create API key.");
      return;
    }

    // `data.key` contains the plaintext key — shown once then gone
    onCreated((data as { key: string }).key);
    onClose();
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="key-name">Key name</Label>
        <Input
          id="key-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. External sync service"
          disabled={creating}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="key-expiry">Expires in</Label>
        <Select value={expiry} onValueChange={setExpiry} disabled={creating}>
          <SelectTrigger id="key-expiry">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPIRY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}
      <div className="flex flex-col space-y-2 w-full md:flex-row-reverse pb-2 md:gap-2 md:space-y-0 md:justify-start">
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? "Creating..." : "Create key"}
        </Button>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={creating}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Create dialog (responsive) ──────────────────────────────────────────────

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: string) => void;
}

function CreateApiKeyDialog({ open, onOpenChange, onCreated }: CreateDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const handleClose = () => onOpenChange(false);
  const handleCreated = (key: string) => {
    onOpenChange(false);
    onCreated(key);
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API key</DialogTitle>
            <DialogDescription>
              Give the key a memorable name. The secret value is only shown once
              immediately after creation — copy it somewhere safe.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <CreateForm onCreated={handleCreated} onClose={handleClose} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Create API key</DrawerTitle>
          <DrawerDescription>
            Give the key a memorable name. The secret value is only shown once
            immediately after creation — copy it somewhere safe.
          </DrawerDescription>
        </DrawerHeader>
        <CreateForm
          className="px-4"
          onCreated={handleCreated}
          onClose={handleClose}
        />
        <DrawerFooter className="pt-0" />
      </DrawerContent>
    </Drawer>
  );
}

// ─── Reveal dialog (shows plaintext key once) ────────────────────────────────

interface RevealDialogProps {
  apiKey: string | null;
  onClose: () => void;
}

function RevealKeyDialog({ apiKey, onClose }: RevealDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={!!apiKey} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
          <DialogDescription>
            Copy your new API key now. It will not be shown again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono break-all">
              {apiKey}
            </code>
            <Button size="icon" variant="outline" onClick={handleCopy}>
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Include this key in requests as:{" "}
            <code className="font-mono">Authorization: Bearer &lt;key&gt;</code>
          </p>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main page content ───────────────────────────────────────────────────────

export function ApiKeysPageContent() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: apiError } = await authClient.apiKey.list({});
    setLoading(false);
    if (apiError) {
      setError(apiError.message ?? "Failed to load API keys.");
      return;
    }
    const result = data as { apiKeys: ApiKey[] } | null;
    setKeys(result?.apiKeys ?? []);
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreated = (key: string) => {
    setNewKeyValue(key);
    loadKeys();
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    const { error: apiError } = await authClient.apiKey.delete({ keyId: id });
    setRevoking(null);
    if (apiError) {
      setError(apiError.message ?? "Failed to revoke key.");
      return;
    }
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  return (
    <div className="container mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage bearer tokens for external service access.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create key
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Key className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No API keys yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create a key to allow external services to authenticate.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key prefix</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => {
                const expired = isExpired(k.expiresAt);
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">
                      {k.name ?? <span className="text-muted-foreground italic">Unnamed</span>}
                    </TableCell>
                    <TableCell>
                      <code className="font-mono text-sm text-muted-foreground">
                        {k.start ?? k.prefix ?? "—"}…
                      </code>
                    </TableCell>
                    <TableCell>{formatDate(k.createdAt)}</TableCell>
                    <TableCell>{formatDate(k.expiresAt)}</TableCell>
                    <TableCell>
                      {!k.enabled ? (
                        <Badge variant="secondary">Disabled</Badge>
                      ) : expired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={revoking === k.id}
                        onClick={() => handleRevoke(k.id)}
                        title="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />

      <RevealKeyDialog
        apiKey={newKeyValue}
        onClose={() => setNewKeyValue(null)}
      />
    </div>
  );
}
