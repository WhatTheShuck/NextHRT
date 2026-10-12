/** What GET /api/search returns: everything this user may search, in one payload. */
export interface SearchIndexPayload {
  /** hrefs from lib/search/pages.ts the user may open. */
  pages: string[];
  people: SearchPerson[];
  catalogue: SearchCatalogueItem[];
}

export interface SearchPerson {
  id: number;
  /** Preferred name where set, otherwise legal. */
  name: string;
  /** Legal name, only when it differs from `name`, so either one finds them. */
  legalName: string | null;
  title: string;
  department: string;
  location: string;
  active: boolean;
}

export type SearchCatalogueKind =
  "training" | "sop" | "ticket" | "department" | "location";

export interface SearchCatalogueItem {
  kind: SearchCatalogueKind;
  id: number;
  title: string;
  /** Extra searchable text: ticket code, training category, parent department, state. */
  detail: string | null;
  href: string;
  active: boolean;
}
