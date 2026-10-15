import { describe, it, expect } from "vitest";
import {
  descendants,
  findCycles,
  managerChain,
  toChildrenIndex,
  toManagerMap,
  wouldCreateCycle,
} from "../reportingLine";

// 1 Brett → 2 Rodrigo → 3 Scott → 4, 5 (techs); 2 Rodrigo → 6 Brody
const tree = [
  { id: 1, reportsToId: null },
  { id: 2, reportsToId: 1 },
  { id: 3, reportsToId: 2 },
  { id: 4, reportsToId: 3 },
  { id: 5, reportsToId: 3 },
  { id: 6, reportsToId: 2 },
];

describe("reportingLine", () => {
  it("finds everyone below a manager at any depth, excluding the manager", () => {
    const children = toChildrenIndex(tree);
    expect([...descendants(2, children)].sort()).toEqual([3, 4, 5, 6]);
    expect([...descendants(4, children)]).toEqual([]);
  });

  it("walks the chain of managers nearest first", () => {
    expect(managerChain(4, toManagerMap(tree))).toEqual([3, 2, 1]);
  });

  it("detects a change that would make someone their own manager", () => {
    const managers = toManagerMap(tree);
    expect(wouldCreateCycle(2, 4, managers)).toBe(true); // Rodrigo under his own tech
    expect(wouldCreateCycle(3, 3, managers)).toBe(true);
    expect(wouldCreateCycle(4, 6, managers)).toBe(false); // tech moves to Brody
    expect(wouldCreateCycle(2, null, managers)).toBe(false);
  });

  it("survives an existing loop instead of walking forever", () => {
    const looped = [
      { id: 1, reportsToId: 2 },
      { id: 2, reportsToId: 1 },
      { id: 3, reportsToId: 1 },
    ];
    expect([...descendants(1, toChildrenIndex(looped))].sort()).toEqual([2, 3]);
    expect(managerChain(3, toManagerMap(looped))).toEqual([1, 2]);
    expect(findCycles(toManagerMap(looped)).map((c) => c.sort())).toEqual([[1, 2]]);
  });

  it("finds no cycles in a proper tree", () => {
    expect(findCycles(toManagerMap(tree))).toEqual([]);
  });
});
