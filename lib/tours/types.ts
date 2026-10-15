/**
 * Page tours: the "dim everything, highlight one thing, explain it" overlays
 * started from the help button (and automatically, per the user's setting).
 *
 * Tours are plain data so the server can check keys and the help panel can
 * show the same words without running a tour.
 */

/** What the signed-in user can do, as far as tours care. */
export interface Audience {
  admin: boolean;
  /** Department manager, or a line manager once line-manager authority is on. */
  manager: boolean;
  warden: boolean;
  /** The account is linked to an employee record. */
  linked: boolean;
}

export type Who = (audience: Audience) => boolean;

export type TutorialMode = "Off" | "FirstVisit" | "Always";

export interface TourStep {
  /**
   * The `data-tour` value of the element to highlight. Leave out (along with
   * `selector`) for a message centred on the page.
   */
  target?: string;
  /** A CSS selector, for elements we'd rather not add a data-tour to. */
  selector?: string;
  title: string;
  /** Plain text. Keep it to one or two short sentences. */
  body: string;
  /** Only show this step to these people. A step whose element isn't on the page is skipped anyway. */
  when?: Who;
  /** Adds a "New" badge for things that arrived in the current release. */
  isNew?: boolean;
  side?: "top" | "bottom" | "left" | "right";
}

export interface PageTip {
  text: string;
  when?: Who;
}

export interface PageTour {
  /** Stable id, e.g. "dashboard". Seen-state is stored as `${id}@${version}`. */
  id: string;
  /** Bump when the tour is rewritten enough that people should see it again. */
  version: number;
  /** Matched against the pathname (no query string). First match wins. */
  path: RegExp;
  /** Shown in the help panel, e.g. "Your dashboard". */
  title: string;
  /** One or two sentences on what this page is for. */
  summary: string;
  tips?: PageTip[];
  steps: TourStep[];
  /** Only offer this tour to these people. */
  when?: Who;
}

export interface WhatsNewItem {
  title: string;
  body: string;
  when?: Who;
  /** "Show me" takes the user here and runs that page's tour. */
  href?: string;
  group: "everyone" | "managers" | "admins";
}

export interface WhatsNewRelease {
  /** Stored as `whats-new@${id}` once the user has seen it. */
  id: string;
  title: string;
  items: WhatsNewItem[];
}
