/**
 * Pure helpers for the person-to-person reporting line (`Employee.reportsToId`).
 * Every walk keeps a visited set, so a cycle that slipped past the write-time checks ends
 * the walk instead of looping (docs/workday-org-import-spec.md §9.1).
 */

export interface ReportingNode {
  id: number;
  reportsToId: number | null;
}

/** employeeId → their manager's id (or null). */
export type ManagerMap = Map<number, number | null>;

export function toManagerMap(nodes: ReportingNode[]): ManagerMap {
  return new Map(nodes.map((n) => [n.id, n.reportsToId]));
}

/** managerId → ids of their direct reports. */
export function toChildrenIndex(nodes: ReportingNode[]): Map<number, number[]> {
  const index = new Map<number, number[]>();
  for (const n of nodes) {
    if (n.reportsToId === null) continue;
    const list = index.get(n.reportsToId);
    if (list) list.push(n.id);
    else index.set(n.reportsToId, [n.id]);
  }
  return index;
}

/** Everyone below `managerId` at any depth, excluding `managerId` itself. */
export function descendants(managerId: number, children: Map<number, number[]>): Set<number> {
  const found = new Set<number>();
  const stack = [...(children.get(managerId) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === managerId || found.has(id)) continue;
    found.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return found;
}

/** `employeeId`'s managers, nearest first. Stops at the top or on a loop. */
export function managerChain(employeeId: number, managers: ManagerMap): number[] {
  const chain: number[] = [];
  const seen = new Set<number>([employeeId]);
  let current = managers.get(employeeId) ?? null;
  while (current !== null && !seen.has(current)) {
    chain.push(current);
    seen.add(current);
    current = managers.get(current) ?? null;
  }
  return chain;
}

/** Would setting `employeeId`'s manager to `newManagerId` make them their own (indirect) manager? */
export function wouldCreateCycle(
  employeeId: number,
  newManagerId: number | null,
  managers: ManagerMap,
): boolean {
  if (newManagerId === null) return false;
  if (newManagerId === employeeId) return true;
  return managerChain(newManagerId, managers).includes(employeeId);
}

/** Every reporting loop in the map, each as its member ids (used after applying a batch). */
export function findCycles(managers: ManagerMap): number[][] {
  const cycles: number[][] = [];
  const done = new Set<number>();
  for (const start of managers.keys()) {
    if (done.has(start)) continue;
    const path: number[] = [];
    const onPath = new Set<number>();
    let current: number | null = start;
    while (current !== null && !done.has(current) && !onPath.has(current)) {
      path.push(current);
      onPath.add(current);
      current = managers.get(current) ?? null;
    }
    if (current !== null && onPath.has(current)) cycles.push(path.slice(path.indexOf(current)));
    path.forEach((id) => done.add(id));
  }
  return cycles;
}
