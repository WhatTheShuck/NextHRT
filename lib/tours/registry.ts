import type { PageTour } from "./types";
import { generalTours } from "./pages/general";
import { selfServiceTours } from "./pages/self-service";
import { formsTours } from "./pages/forms";
import { reportsTours } from "./pages/reports";
import { orgAdminTours } from "./pages/admin-org";
import { adminTours } from "./pages/admin";

/** Every page tour. Paths are anchored regexes, so order only matters if two overlap. */
export const allTours: PageTour[] = [
  ...generalTours,
  ...selfServiceTours,
  ...formsTours,
  ...reportsTours,
  ...orgAdminTours,
  ...adminTours,
];

export function tourForPath(pathname: string): PageTour | undefined {
  return allTours.find((t) => t.path.test(pathname));
}

export function tourById(id: string): PageTour | undefined {
  return allTours.find((t) => t.id === id);
}
