"use client";

import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  Clock,
  CornerDownLeft,
  GraduationCap,
  History,
  IdCard,
  Link2,
  LogOut,
  MapPin,
  Moon,
  RotateCw,
  Search,
  Sun,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import { Badge } from "@/components/ui/badge";
import { signOut } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
  createSearchIndex,
  type Range,
  type SearchMatch,
} from "@/lib/search/fuzzy";
import { searchPages, type SearchPage } from "@/lib/search/pages";
import {
  clearRecent,
  loadRecent,
  pushRecent,
  type RecentEntry,
} from "@/lib/search/recent";
import type {
  SearchCatalogueItem,
  SearchCatalogueKind,
  SearchPerson,
} from "@/lib/search/types";
import { useSearchIndex } from "./use-search-index";
import { useModKey } from "./use-mod-key";

type Group = "pages" | "people" | "catalogue" | "actions";
type Scope = "all" | Group;

const SCOPES: { id: Scope; label: string; prefix?: string }[] = [
  { id: "all", label: "All" },
  { id: "pages", label: "Pages", prefix: "/" },
  { id: "people", label: "People", prefix: "@" },
  { id: "catalogue", label: "Catalogue", prefix: "#" },
  { id: "actions", label: "Actions", prefix: ">" },
];

const GROUP_LABEL: Record<Group, string> = {
  pages: "Pages",
  people: "People",
  catalogue: "Catalogue",
  actions: "Actions",
};

// How many of each group "All" shows before offering "Show all".
const ALL_SCOPE_LIMIT: Record<Group, number> = {
  pages: 5,
  people: 6,
  catalogue: 5,
  actions: 3,
};
const SCOPED_LIMIT = 60;

// `also` makes "forklift licence" or "perth site" find the right kind of thing.
const KIND: Record<
  SearchCatalogueKind,
  { label: string; also: string; icon: LucideIcon }
> = {
  training: { label: "Training", also: "course", icon: GraduationCap },
  sop: {
    label: "SOP",
    also: "standard operating procedure",
    icon: BookOpenCheck,
  },
  ticket: {
    label: "Ticket",
    also: "licence license certificate",
    icon: IdCard,
  },
  department: { label: "Department", also: "team", icon: Building2 },
  location: { label: "Location", also: "site office branch", icon: MapPin },
};

// Keywords are joined with this so the matched one can be found again for display.
const KEYWORD_SEP = " · ";

interface Action {
  id: string;
  title: string;
  keywords: string;
  icon: LucideIcon;
  run: () => void;
}

interface Result {
  key: string;
  group: Group;
  score: number;
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  href?: string;
  run?: () => void;
  /** What to remember in "Recent" when opened. */
  recent?: RecentEntry;
}

function Highlight({ text, ranges }: { text: string; ranges?: Range[] }) {
  if (!ranges?.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([start, end], i) => {
    if (start > at) out.push(text.slice(at, start));
    out.push(
      <mark
        key={i}
        className="rounded-[2px] bg-primary/15 font-semibold text-foreground"
      >
        {text.slice(start, end)}
      </mark>,
    );
    at = end;
  });
  out.push(text.slice(at));
  return <>{out}</>;
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 min-w-5 items-center justify-center rounded border bg-muted px-1 font-sans text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
}

/** The keyword a match landed on, so "evac" can explain why "Current Employee List" showed up. */
function matchedKeyword(joined: string, ranges?: Range[]): string | null {
  if (!ranges?.length) return null;
  const at = ranges[0][0];
  let offset = 0;
  for (const kw of joined.split(KEYWORD_SEP)) {
    if (at >= offset && at < offset + kw.length) return kw;
    offset += kw.length + KEYWORD_SEP.length;
  }
  return null;
}

const pageResult = (p: SearchPage, m?: SearchMatch<SearchPage>): Result => {
  const Icon = p.icon;
  const keyword =
    m && !m.ranges.has(0)
      ? matchedKeyword(p.keywords.join(KEYWORD_SEP), m.ranges.get(1))
      : null;
  return {
    key: `page:${p.href}`,
    group: "pages",
    score: m?.score ?? 0,
    icon: <Icon />,
    title: <Highlight text={p.title} ranges={m?.ranges.get(0)} />,
    subtitle: keyword ? (
      <span>
        Matches “<span className="font-medium text-foreground">{keyword}</span>”
      </span>
    ) : p.description ? (
      <Highlight text={p.description} ranges={m?.ranges.get(2)} />
    ) : undefined,
    meta: <Highlight text={p.section} ranges={m?.ranges.get(3)} />,
    href: p.href,
    recent: {
      key: `page:${p.href}`,
      title: p.title,
      subtitle: p.section,
      href: p.href,
    },
  };
};

const personResult = (
  p: SearchPerson,
  m?: SearchMatch<SearchPerson>,
): Result => {
  const href = `/employees/${p.id}`;
  const parts: [string, number][] = [
    [p.title, 2],
    [p.department, 3],
    [p.location, 4],
  ];
  return {
    key: `person:${p.id}`,
    group: "people",
    score: m?.score ?? 0,
    icon: (
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground",
          !p.active && "opacity-60",
        )}
      >
        {initials(p.name)}
      </span>
    ),
    title: (
      <>
        <Highlight text={p.name} ranges={m?.ranges.get(0)} />
        {p.legalName && m?.ranges.has(1) && (
          <span className="ml-1.5 font-normal text-muted-foreground">
            (<Highlight text={p.legalName} ranges={m.ranges.get(1)} />)
          </span>
        )}
      </>
    ),
    subtitle: parts.map(([text, field], i) => (
      <span key={field}>
        {i > 0 && " · "}
        <Highlight text={text} ranges={m?.ranges.get(field)} />
      </span>
    )),
    meta: !p.active ? <Badge variant="outline">Inactive</Badge> : undefined,
    href,
    recent: {
      key: `person:${p.id}`,
      title: p.name,
      subtitle: `${p.title} · ${p.department}`,
      href,
    },
  };
};

const catalogueResult = (
  c: SearchCatalogueItem,
  m?: SearchMatch<SearchCatalogueItem>,
): Result => {
  const { label, icon: Icon } = KIND[c.kind];
  const key = `${c.kind}:${c.id}`;
  return {
    key,
    group: "catalogue",
    score: m?.score ?? 0,
    icon: <Icon className={cn(!c.active && "opacity-60")} />,
    title: <Highlight text={c.title} ranges={m?.ranges.get(0)} />,
    subtitle: c.detail ? (
      <Highlight text={c.detail} ranges={m?.ranges.get(1)} />
    ) : undefined,
    meta: (
      <span className="flex items-center gap-1.5">
        {!c.active && <Badge variant="outline">Inactive</Badge>}
        <Highlight
          text={label}
          ranges={m?.ranges.get(2)?.filter(([, end]) => end <= label.length)}
        />
      </span>
    ),
    href: c.href,
    recent: { key, title: c.title, subtitle: label, href: c.href },
  };
};

const actionResult = (a: Action, m?: SearchMatch<Action>): Result => {
  const Icon = a.icon;
  return {
    key: `action:${a.id}`,
    group: "actions",
    score: m?.score ?? 0,
    icon: <Icon />,
    title: <Highlight text={a.title} ranges={m?.ranges.get(0)} />,
    run: a.run,
  };
};

export function CommandPalette({
  open,
  onOpenChange,
  userId,
  initialQuery,
  openCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  initialQuery: string;
  openCount: number;
}) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[10vh] max-w-2xl translate-y-0 gap-0 overflow-hidden p-0 sm:top-[12vh] data-[state=closed]:slide-out-to-top-[2%] data-[state=open]:slide-in-from-top-[2%]">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <DialogDescription className="sr-only">
          Search pages, people and records. Use the arrow keys to move and Enter
          to open.
        </DialogDescription>
        {/* Keyed per open so every open starts from a clean slate. */}
        <PaletteBody
          key={openCount}
          userId={userId}
          initialQuery={initialQuery}
          close={close}
        />
      </DialogContent>
    </Dialog>
  );
}

function PaletteBody({
  userId,
  initialQuery,
  close,
}: {
  userId: string;
  initialQuery: string;
  close: () => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { data, loading, error, refresh } = useSearchIndex(userId, true);
  const inputRef = useRef<HTMLInputElement>(null);
  // The header search bar can hand over what was already typed.
  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<Scope>("all");
  const [picked, setPicked] = useState<{
    resultSet: string;
    key: string;
  } | null>(null);
  const [recent, setRecent] = useState<RecentEntry[]>(() => loadRecent(userId));
  const deferredQuery = useDeferredValue(query);
  const mod = useModKey() ?? "Ctrl";

  const actions = useMemo<Action[]>(() => {
    const dark = resolvedTheme === "dark";
    const list: Action[] = [
      {
        id: "theme",
        title: dark ? "Switch to light mode" : "Switch to dark mode",
        keywords: "theme appearance dark light mode colour",
        icon: dark ? Sun : Moon,
        run: () => {
          setTheme(dark ? "light" : "dark");
          close();
        },
      },
      {
        id: "copy-link",
        title: "Copy link to this page",
        keywords: "share url address clipboard",
        icon: Link2,
        run: () => {
          navigator.clipboard
            .writeText(window.location.href)
            .then(() => toast.success("Link copied"))
            .catch(() => toast.error("Couldn't copy the link"));
          close();
        },
      },
      {
        id: "reload-search",
        title: "Refresh search results",
        keywords: "reload index missing new employee",
        icon: RotateCw,
        run: () => {
          void refresh().then(() => toast.success("Search refreshed"));
        },
      },
      {
        id: "sign-out",
        title: "Sign out",
        keywords: "log out logout exit leave",
        icon: LogOut,
        run: () => {
          void signOut().then(() => {
            // Full reload, not router.push, so no signed-in state (search index included) survives.
            window.location.replace("/auth");
          });
        },
      },
    ];
    if (recent.length > 0) {
      list.push({
        id: "clear-recent",
        title: "Clear recent searches",
        keywords: "history forget",
        icon: History,
        run: () => {
          clearRecent(userId);
          setRecent([]);
        },
      });
    }
    return list;
  }, [resolvedTheme, setTheme, close, refresh, recent.length, userId]);

  const allowedPages = useMemo(() => {
    const allowed = new Set(data?.pages ?? []);
    return searchPages.filter((p) => allowed.has(p.href));
  }, [data]);

  const indexes = useMemo(
    () => ({
      pages: createSearchIndex(allowedPages, (p) => [
        { text: p.title, weight: 1 },
        { text: p.keywords.join(KEYWORD_SEP), weight: 0.78 },
        { text: p.description ?? "", weight: 0.55 },
        { text: p.section, weight: 0.5 },
      ]),
      people: createSearchIndex(data?.people ?? [], (p) => [
        { text: p.name, weight: 1 },
        { text: p.legalName ?? "", weight: 0.95 },
        { text: p.title, weight: 0.6 },
        { text: p.department, weight: 0.55 },
        { text: p.location, weight: 0.45 },
      ]),
      catalogue: createSearchIndex(data?.catalogue ?? [], (c) => [
        { text: c.title, weight: 1 },
        { text: c.detail ?? "", weight: 0.7 },
        { text: `${KIND[c.kind].label} ${KIND[c.kind].also}`, weight: 0.45 },
      ]),
      actions: createSearchIndex(actions, (a) => [
        { text: a.title, weight: 1 },
        { text: a.keywords, weight: 0.7 },
      ]),
    }),
    [allowedPages, data, actions],
  );

  const recentKeys = useMemo(() => new Set(recent.map((r) => r.key)), [recent]);
  // The directory itself only needs a session; offer it whenever there's
  // anyone to find beyond yourself (admins without a linked employee included).
  const canSearchDirectory =
    (data?.people.length ?? 0) > 1 ||
    allowedPages.some((p) => p.href === "/employees");
  const hasCatalogue = (data?.catalogue.length ?? 0) > 0;

  const { groups, counts } = useMemo(() => {
    const q = deferredQuery.trim();
    const empty = {
      groups: [] as { group: Group; items: Result[]; total: number }[],
      counts: {} as Record<Group, number>,
    };
    if (!data) return empty;

    // Something opened before ranks a little higher next time.
    const boost =
      <T,>(key: (item: T) => string, active?: (item: T) => boolean) =>
      (item: T) =>
        (recentKeys.has(key(item)) ? 1.1 : 1) *
        (active && !active(item) ? 0.8 : 1);

    let all: Record<Group, Result[]>;
    if (!q) {
      // Browsing a scope with nothing typed lists it in its natural order.
      all = {
        pages: allowedPages.map((p) => pageResult(p)),
        people: data.people.slice(0, SCOPED_LIMIT).map((p) => personResult(p)),
        catalogue: data.catalogue
          .slice(0, SCOPED_LIMIT)
          .map((c) => catalogueResult(c)),
        actions: actions.map((a) => actionResult(a)),
      };
    } else {
      all = {
        pages: indexes.pages
          .search(q, { boost: boost((p) => `page:${p.href}`) })
          .map((m) => pageResult(m.item, m)),
        people: indexes.people
          .search(q, {
            boost: boost(
              (p) => `person:${p.id}`,
              (p) => p.active,
            ),
          })
          .map((m) => personResult(m.item, m)),
        catalogue: indexes.catalogue
          .search(q, {
            boost: boost(
              (c) => `${c.kind}:${c.id}`,
              (c) => c.active,
            ),
          })
          .map((m) => catalogueResult(m.item, m)),
        actions: indexes.actions.search(q).map((m) => actionResult(m.item, m)),
      };
      // Drop the long tail: weak fuzzy hits far below the best match are noise.
      const top = Math.max(
        0,
        ...Object.values(all).flatMap((rs) =>
          rs.slice(0, 1).map((r) => r.score),
        ),
      );
      const floor = Math.max(0.28, top * 0.45);
      for (const g of Object.keys(all) as Group[])
        all[g] = all[g].filter((r) => r.score >= floor);
    }

    const counts = Object.fromEntries(
      Object.entries(all).map(([g, rs]) => [g, rs.length]),
    ) as Record<Group, number>;
    const wanted = (
      scope === "all" ? (Object.keys(all) as Group[]) : [scope]
    ).filter((g) => all[g].length > 0);
    // Strongest group first, so the best hit is always the top row.
    if (q) wanted.sort((a, b) => all[b][0].score - all[a][0].score);
    const groups = wanted.map((g) => ({
      group: g,
      items: all[g].slice(
        0,
        scope === "all" ? ALL_SCOPE_LIMIT[g] : SCOPED_LIMIT,
      ),
      total: all[g].length,
    }));
    return { groups, counts };
  }, [deferredQuery, scope, data, indexes, allowedPages, actions, recentKeys]);

  const q = deferredQuery.trim();

  // Nothing typed and no scope: recent items, then shortcuts to the main areas.
  const home = useMemo(() => {
    if (q || scope !== "all" || !data) return null;
    const pageByHref = new Map(allowedPages.map((p) => [p.href, p]));
    const people = new Set(data.people.map((p) => `person:${p.id}`));
    const catalogue = new Set(data.catalogue.map((c) => `${c.kind}:${c.id}`));
    // Only offer recents this user can still open.
    const recents = recent
      .filter((r) =>
        r.key.startsWith("page:")
          ? pageByHref.has(r.href)
          : r.key.startsWith("person:")
            ? people.has(r.key)
            : catalogue.has(r.key),
      )
      .map((r): Result => {
        const page = pageByHref.get(r.href);
        const Icon =
          page?.icon ?? (r.key.startsWith("person:") ? Users : Clock);
        return {
          key: `recent:${r.key}`,
          group: "pages",
          score: 0,
          icon: <Icon />,
          title: r.title,
          subtitle: r.subtitle,
          href: r.href,
          recent: r,
        };
      });
    const jumpTo = allowedPages
      .filter((p) => p.section === "Home")
      .map((p) => pageResult(p));
    return { recents, jumpTo, actions: actions.map((a) => actionResult(a)) };
  }, [q, scope, data, allowedPages, recent, actions]);

  const directoryItem: Result | null =
    q && canSearchDirectory && (scope === "all" || scope === "people")
      ? {
          key: "directory-search",
          group: "people",
          score: 0,
          icon: <Search />,
          title: (
            <span>
              Search the employee directory for “
              <span className="font-semibold">{q}</span>”
            </span>
          ),
          href: `/employees?q=${encodeURIComponent(q)}`,
        }
      : null;

  const visible: Result[] = home
    ? [...home.recents, ...home.jumpTo, ...home.actions]
    : [
        ...groups.flatMap((g) => g.items),
        ...(directoryItem ? [directoryItem] : []),
      ];

  // The highlight goes back to the top row whenever the query, scope or data
  // changes, and otherwise stays wherever the arrow keys or mouse put it.
  const resultSet = `${scope}|${q}|${data ? "loaded" : "loading"}`;
  const selected =
    picked?.resultSet === resultSet &&
    (picked.key.startsWith("more:") ||
      visible.some((v) => v.key === picked.key))
      ? picked.key
      : (visible[0]?.key ?? "");

  const run = (r: Result, newTab = false) => {
    if (r.href) {
      if (r.recent) setRecent(pushRecent(userId, r.recent));
      if (newTab) {
        window.open(r.href, "_blank", "noopener");
      } else {
        router.push(r.href);
        close();
      }
      return;
    }
    r.run?.();
  };

  const visibleScopes = SCOPES.filter(
    (s) => s.id !== "catalogue" || hasCatalogue,
  );

  const pickScope = (s: Scope) => {
    setScope(s);
    inputRef.current?.focus();
  };

  const onQueryChange = (value: string) => {
    // Typing a scope prefix into an empty box switches scope instead: "@" → People.
    if (query === "" && scope === "all") {
      const byPrefix = visibleScopes.find(
        (s) => s.prefix && s.prefix === value,
      );
      if (byPrefix) {
        setScope(byPrefix.id);
        return;
      }
    }
    setQuery(value);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      const r = visible.find((v) => v.key === selected);
      if (r?.href) {
        e.preventDefault();
        run(r, true);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      const i = visibleScopes.findIndex((s) => s.id === scope);
      const next =
        (i + (e.shiftKey ? -1 : 1) + visibleScopes.length) %
        visibleScopes.length;
      setScope(visibleScopes[next].id);
    } else if (e.key === "Backspace" && query === "" && scope !== "all") {
      e.preventDefault();
      setScope("all");
    }
  };

  const renderItem = (r: Result) => (
    <CommandItem
      key={r.key}
      value={r.key}
      onSelect={() => run(r)}
      // Ctrl/⌘-click and middle-click open in a new tab, like a normal link.
      onClickCapture={(e) => {
        if (r.href && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          e.stopPropagation();
          run(r, true);
        }
      }}
      onAuxClick={(e) => {
        if (r.href && e.button === 1) run(r, true);
      }}
      className="group gap-3 py-2"
    >
      <span className="grid size-7 shrink-0 place-items-center text-muted-foreground">
        {r.icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{r.title}</span>
        {r.subtitle && (
          <span className="truncate text-xs text-muted-foreground">
            {r.subtitle}
          </span>
        )}
      </span>
      {r.meta && (
        <span className="ml-2 hidden shrink-0 text-xs text-muted-foreground sm:block">
          {r.meta}
        </span>
      )}
      {r.href && (
        <CornerDownLeft className="hidden shrink-0 text-muted-foreground opacity-0 group-data-[selected=true]:opacity-100 sm:block" />
      )}
    </CommandItem>
  );

  const showAll = (g: { group: Group; total: number; items: Result[] }) =>
    scope === "all" && g.total > g.items.length ? (
      <CommandItem
        key={`more:${g.group}`}
        value={`more:${g.group}`}
        onSelect={() => pickScope(g.group)}
        className="gap-3 py-2 text-muted-foreground"
      >
        <span className="grid size-7 shrink-0 place-items-center">
          <ArrowRight />
        </span>
        Show all {g.total} {GROUP_LABEL[g.group].toLowerCase()}
      </CommandItem>
    ) : null;

  const nothingFound = !home && !loading && !error && groups.length === 0;

  return (
    <Command
      shouldFilter={false}
      loop
      value={selected}
      onValueChange={(key) => setPicked({ resultSet, key })}
      onKeyDown={onKeyDown}
      className="rounded-none"
    >
      <div className="flex items-center gap-2 border-b px-4 pr-12">
        <Search className="size-5 shrink-0 text-muted-foreground" />
        {scope !== "all" && (
          <Badge variant="secondary" className="shrink-0">
            {SCOPES.find((s) => s.id === scope)?.label}
          </Badge>
        )}
        <CommandPrimitive.Input
          ref={inputRef}
          value={query}
          onValueChange={onQueryChange}
          placeholder={
            scope === "people"
              ? "Search people by name, job title, department…"
              : scope === "pages"
                ? "Search pages and reports…"
                : scope === "catalogue"
                  ? "Search training, SOPs, tickets, departments…"
                  : scope === "actions"
                    ? "Search actions…"
                    : "Search pages, people, training…"
          }
          className="flex h-14 w-full bg-transparent text-base outline-hidden placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-2">
        {visibleScopes.map((s) => {
          const count =
            s.id === "all" || !q ? null : (counts[s.id as Group] ?? 0);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => pickScope(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                scope === s.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {s.label}
              {count !== null && (
                <span
                  className={cn(
                    "tabular-nums",
                    scope === s.id ? "opacity-80" : "opacity-60",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <CommandList className="max-h-[min(60vh,30rem)] scroll-py-2 p-1">
        {loading && (
          <CommandPrimitive.Loading>
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading search…
            </div>
          </CommandPrimitive.Loading>
        )}

        {error && (
          <CommandGroup>
            <CommandItem
              value="retry"
              onSelect={refresh}
              className="gap-3 py-2"
            >
              <span className="grid size-7 place-items-center">
                <RotateCw />
              </span>
              Search couldn&apos;t load. Press Enter to try again.
            </CommandItem>
          </CommandGroup>
        )}

        {home && (
          <>
            {home.recents.length > 0 && (
              <CommandGroup heading="Recent">
                {home.recents.map(renderItem)}
              </CommandGroup>
            )}
            {home.jumpTo.length > 0 && (
              <CommandGroup heading="Go to">
                {home.jumpTo.map(renderItem)}
              </CommandGroup>
            )}
            <CommandGroup heading="Actions">
              {home.actions.map(renderItem)}
            </CommandGroup>
          </>
        )}

        {!home &&
          groups.map((g) => (
            <CommandGroup key={g.group} heading={GROUP_LABEL[g.group]}>
              {g.items.map(renderItem)}
              {showAll(g)}
              {g.group === "people" &&
                directoryItem &&
                renderItem(directoryItem)}
            </CommandGroup>
          ))}

        {/* No people matched, but the directory's plain text search might still help. */}
        {!home &&
          directoryItem &&
          !groups.some((g) => g.group === "people") && (
            <CommandGroup heading="People">
              {renderItem(directoryItem)}
            </CommandGroup>
          )}

        {nothingFound && (
          <div className="px-6 py-10 text-center text-sm">
            <p className="font-medium">
              No{" "}
              {scope === "all"
                ? "results"
                : GROUP_LABEL[scope as Group].toLowerCase()}{" "}
              for “{q}”
            </p>
            <p className="mt-1 text-muted-foreground">
              {scope !== "all"
                ? "Try searching everything instead (press Backspace)."
                : "Check the spelling, or try fewer words."}
            </p>
          </div>
        )}
      </CommandList>

      <div className="flex items-center justify-between gap-4 whitespace-nowrap border-t bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
        <div className="hidden items-center gap-3 md:flex">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="flex items-center gap-1">
            <Kbd>↵</Kbd> open
          </span>
          <span className="flex items-center gap-1">
            <Kbd>{mod}</Kbd>
            <Kbd>↵</Kbd> new tab
          </span>
          <span className="flex items-center gap-1">
            <Kbd>Tab</Kbd> filter
          </span>
        </div>
        {/* Scope prefixes, typed as the first character */}
        <div className="flex items-center gap-1">
          <Kbd>@</Kbd> people <Kbd>/</Kbd> pages <Kbd>&gt;</Kbd> actions
        </div>
      </div>
    </Command>
  );
}
