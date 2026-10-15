import { who } from "../audience";
import type { PageTour } from "../types";

/** Users & Access: permissions and linking, the org chart, the Workday import, delegated access and API keys. */
export const orgAdminTours: PageTour[] = [
  {
    id: "admin-access",
    version: 1,
    path: /^\/admin\/access$/,
    title: "Users & Access",
    summary: "Everything about who can do what in HRT: roles and account linking, the org chart, and API keys.",
    when: who.admin,
    tips: [
      { text: "The red number on User Permissions counts people who have signed in but aren't linked to an employee yet." },
    ],
    steps: [
      {
        title: "Users & Access",
        body: "User Permissions, Org Chart and API Keys now live together on this page.",
        isNew: true,
      },
      {
        target: "card:/admin/permissions",
        title: "User Permissions",
        body: "Set each person's role and connect their sign-in to their employee record. The red number counts people waiting to be linked.",
      },
      {
        target: "card:/admin/org-chart",
        title: "Org Chart",
        body: "See departments and reporting lines, import Workday's org chart, and manage delegated access.",
        isNew: true,
      },
      {
        target: "card:/admin/api-keys",
        title: "API Keys",
        body: "Keys that let other systems connect to HRT.",
      },
    ],
  },
  {
    id: "admin-permissions",
    version: 1,
    path: /^\/admin\/permissions$/,
    title: "User Permissions",
    summary:
      "Choose what each person can do in HRT, and connect each sign-in to the right employee record so they can use HRT.",
    when: who.admin,
    tips: [
      { text: "If none of the Suggested Links look right, link the person by hand on the User-Employee Mapping tab." },
      { text: "The Suggested Links list doesn't update by itself. Click Refresh after linking people or changing App Settings." },
      { text: "People are only emailed the first time they're linked, not when you move them to a different record." },
    ],
    steps: [
      {
        title: "Linking accounts",
        body: "When someone signs in for the first time, HRT makes an account for them. Until you connect it to their employee record, they can't see anything.",
      },
      {
        target: "permissions-tab-roles",
        title: "User Roles",
        body: "Choose what each person can do: User, Fire Warden, Department Manager or Admin.",
      },
      {
        target: "roles-edit",
        title: "Edit Role",
        body: "Change someone's role. For a Department Manager, also tick the departments they look after under Managed Departments.",
      },
      {
        target: "permissions-tab-mapping",
        title: "User-Employee Mapping",
        body: "Connect a sign-in to an employee record by hand, or unlink one that's wrong.",
      },
      {
        target: "mapping-unlinked-only",
        title: "Unlinked only",
        body: "Turn this on to show only people still waiting to be linked.",
        isNew: true,
      },
      {
        target: "mapping-map",
        title: "Map",
        body: "Click Map and pick their employee record. The first time someone is linked, they're emailed that their account is ready.",
        isNew: true,
      },
      {
        target: "permissions-tab-suggestions",
        title: "Suggested Links",
        body: "HRT compares unlinked sign-ins with employee records and suggests likely matches, best first.",
      },
      {
        target: "suggestions-link",
        title: "Link",
        body: "Click Link to accept a match. The person is emailed straight away to say their account is ready.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-org-chart",
    version: 1,
    path: /^\/admin\/org-chart$/,
    title: "Org Chart",
    summary:
      "See how people are organised, by department or by who reports to whom, and spot gaps like missing managers or unlinked sign-ins.",
    when: who.admin,
    tips: [
      { text: "Hover over someone in a department and click the folder icon to move them to another department." },
      { text: "Reporting lines and delegated access don't change who sees what until line-manager authority is switched on." },
      { text: "Click Refresh after making changes elsewhere to update the chart." },
    ],
    steps: [
      {
        target: "org-view-toggle",
        title: "Two views",
        body: "Departments shows who works in each department and who manages it. Reporting lines shows who reports to whom.",
        isNew: true,
      },
      {
        target: "org-stats",
        title: "At a glance",
        body: "Amber numbers need attention: employees with no sign-in linked, and departments with no manager.",
      },
      {
        target: "org-filters",
        title: "Search and filter",
        body: "Search for a department or person. Turn on Issues only to see just the departments that need attention.",
      },
      {
        target: "org-department",
        title: "Departments",
        body: "Each card lists the managers and staff. A green tick means that person's sign-in is linked; amber means it isn't.",
      },
      {
        target: "org-unlinked-users",
        title: "Unlinked sign-ins",
        body: "People who have signed in but aren't connected to an employee record yet. Link them in User Permissions.",
      },
      {
        target: "org-lines-legend",
        title: "Reading the lines",
        body: "A purple tag is delegated access: that person sees, or acts for, another manager's team. External means they're not in Workday, so their manager is set in HRT.",
        isNew: true,
      },
      {
        target: "org-lines-tree",
        title: "Who reports to whom",
        body: "Click the arrows to open or close a team. Click a name to open their record.",
        isNew: true,
      },
      {
        target: "org-lines-unplaced",
        title: "Not in a reporting line yet",
        body: "Active employees with no manager and no team. Everyone needs a line before you switch on line-manager authority.",
        isNew: true,
      },
      {
        target: "org-lines-empty",
        title: "No reporting lines yet",
        body: "Upload a Workday export and apply its Reports to suggestions, or set Reports To on an employee's record.",
        isNew: true,
      },
      {
        target: "org-delegated-access",
        title: "Delegated access",
        body: "Let someone see, or act for, a manager's team, beyond their own reporting line.",
        isNew: true,
      },
      {
        target: "org-switchover",
        title: "Switch-over readiness",
        body: "Line-manager authority means managers see the people who report to them, instead of whole departments. Check you're ready here, then switch.",
        isNew: true,
      },
      {
        target: "org-import",
        title: "Workday import",
        body: "Upload Workday's org chart to get suggested updates to reporting lines, titles and departments.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-workday-import",
    version: 1,
    path: /^\/admin\/org-chart\/import$/,
    title: "Workday import",
    summary:
      "Upload Workday's org chart export and review the suggested changes. Nothing in HRT changes until you tick a suggestion and apply it.",
    when: who.admin,
    tips: [
      { text: "Location is never imported from Workday." },
      { text: "A new upload replaces the open import. Anything you already applied stays applied." },
      { text: "Replay decisions only runs on a copy of the same HRT. It stops before changing anything if it isn't." },
    ],
    steps: [
      {
        target: "import-upload",
        title: "Upload the export",
        body: "Drop Workday's .xlsx export here, or click to choose it. You'll go straight to a review page.",
        isNew: true,
      },
      {
        target: "import-recent",
        title: "Recent imports",
        body: "Only the newest upload is Open for applying. Older ones stay here as a record of what was applied.",
        isNew: true,
      },
      {
        target: "import-decisions",
        title: "Moving decisions",
        body: "Export decisions saves what you applied to a file. Replay decisions applies that file on another copy of HRT, skipping anything that has changed since.",
        isNew: true,
      },
      {
        target: "import-rules-link",
        title: "Ignore rules",
        body: "Suggestions you chose to ignore forever. Open this to see them, or bring one back.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-workday-import-review",
    version: 1,
    path: /^\/admin\/org-chart\/import\/\d+$/,
    title: "Reviewing an import",
    summary:
      "Every difference between Workday and HRT, as one line per change. Decide each line, then apply the ones you've ticked.",
    when: who.admin,
    tips: [
      { text: "Your ticks are kept if you refresh the page, but not if you close the tab." },
      { text: "You don't have to finish in one go. Apply some lines now and come back for the rest." },
      { text: "Open a line's Impact to see what training, tickets or access would change before you tick it." },
    ],
    steps: [
      {
        target: "review-filters",
        title: "Filter by type",
        body: "Each chip is a kind of suggestion, with how many there are. Chips with a warning sign only flag something to check; they can't be applied.",
        isNew: true,
      },
      {
        target: "review-search",
        title: "Search",
        body: "Find a person, title or department.",
        isNew: true,
      },
      {
        target: "review-person",
        title: "One card per person",
        body: "What Workday says, what HRT has now, and a line for each suggested change. Tick all and Cross all decide every line on the card.",
        isNew: true,
      },
      {
        target: "review-decide",
        title: "Decide each line",
        body: "✓ applies the change. ✗ skips it this time; it comes back on the next import. The crossed-out eye ignores it forever.",
        isNew: true,
      },
      {
        target: "review-bulk",
        title: "Decide many at once",
        body: "Tick all shown and Cross all shown decide every line you can see. Filter first to work through one kind of change at a time.",
        isNew: true,
      },
      {
        target: "review-apply-bar",
        title: "Apply",
        body: "Shows how many lines you've ticked and crossed. Click Apply to see a summary, then confirm.",
        side: "top",
        isNew: true,
      },
      {
        target: "review-needs-manager",
        title: "Choose a manager",
        body: "Some lines suggest more than one possible manager, and Apply waits until you pick one. Click here to jump to the next one.",
        side: "top",
        isNew: true,
      },
      {
        title: "Nothing changes until you apply",
        body: "Ticking a line only marks it. HRT changes when you click Apply, and your ticks are kept if you refresh the page.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-workday-ignore-rules",
    version: 1,
    path: /^\/admin\/org-chart\/import\/rules$/,
    title: "Ignore rules",
    summary: "Suggestions you chose to ignore forever. Each rule hides one exact value for one person.",
    when: who.admin,
    tips: [
      { text: "If Workday later says something different, it's suggested again even with a rule in place." },
    ],
    steps: [
      {
        target: "rules-table",
        title: "Ignored suggestions",
        body: "Who it's for, what was suggested, the value you ignored and any note you left.",
        isNew: true,
      },
      {
        selector: 'button[aria-label="Remove rule"]',
        title: "Remove",
        body: "Removes the rule, so the suggestion can appear again on the next review.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-delegated-access",
    version: 1,
    path: /^\/admin\/org-chart\/access$/,
    title: "Delegated access",
    summary:
      "Let someone see, or act for, a manager's team, beyond their own reporting line. Grants only take effect once line-manager authority is switched on.",
    when: who.admin,
    tips: [
      { text: "Grants do nothing until line-manager authority is switched on, on the Switch-over readiness page." },
      { text: "Use Department and Job family to narrow a grant to part of a manager's team." },
    ],
    steps: [
      {
        target: "access-add",
        title: "Add a grant",
        body: "Pick the Person, then the manager under Sees the team of. Department and Job family are optional and narrow the team.",
        isNew: true,
      },
      {
        target: "access-level",
        title: "Level",
        body: "View only lets them see the team's records. Acts for the manager also lets them approve training requests and get the manager's expiry emails.",
        isNew: true,
      },
      {
        target: "access-grants",
        title: "Current grants",
        body: "Change a grant's Level right here. Covers shows who it reaches today; Nobody means it reaches no one.",
        isNew: true,
      },
      {
        selector: 'button[aria-label="Remove grant"]',
        title: "Remove",
        body: "Takes the grant away, after you confirm. You can add it again later if you need to.",
        isNew: true,
      },
      {
        title: "Not switched on yet?",
        body: "Grants only take effect once line-manager authority is switched on. Until then, you can set them up ready.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-switchover",
    version: 1,
    path: /^\/admin\/org-chart\/switchover$/,
    title: "Switch-over readiness",
    summary:
      "Checks you're ready to move from department managers to line managers, and lets you make the switch. You can switch back.",
    when: who.admin,
    tips: [
      { text: "The switch changes who sees whom for everyone, from their next page load." },
      { text: "Department-manager grants are kept after the switch, so switching back puts things as they were." },
      { text: "Click Refresh after fixing reporting lines to update the report." },
    ],
    steps: [
      {
        title: "Line-manager authority",
        body: "Today, department managers see everyone in their departments. Line-manager authority changes this: managers see the people who report to them.",
        isNew: true,
      },
      {
        target: "switchover-readiness",
        title: "Are you ready?",
        body: "Ready means everyone has a reporting line and every department grant is accounted for. Otherwise, it counts what's left to sort out.",
        isNew: true,
      },
      {
        target: "switchover-unlined",
        title: "No reporting line",
        body: "Active employees with no manager. After the switch, only admins see them until they get one.",
        isNew: true,
      },
      {
        target: "switchover-grants",
        title: "Department-manager grants",
        body: "What happens to each manager's departments after the switch. Amber ones still need work, usually delegated access so the manager keeps seeing those people.",
        isNew: true,
      },
      {
        target: "switchover-create",
        title: "Create suggested grants",
        body: "Tick the suggested grants you want, or Select all, then create them. Select all leaves out people with no reporting line, as they've often left.",
        side: "top",
        isNew: true,
      },
      {
        target: "switchover-mode",
        title: "The switch",
        body: "This changes who sees whom for everyone. Department-manager grants are kept, so you can switch back at any time.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-api-keys",
    version: 1,
    path: /^\/admin\/api-keys$/,
    title: "API Keys",
    summary: "Keys that let other systems connect to HRT. Create one for each service, and revoke it when it's no longer needed.",
    when: who.admin,
    tips: [
      { text: "A new key is only shown once. Copy it somewhere safe before closing the window." },
      { text: "Revoking a key takes effect immediately and can't be undone." },
    ],
    steps: [
      {
        target: "api-keys-create",
        title: "Create a key",
        body: "Give the key a name and choose when it expires. Copy it straight away; you won't see it again.",
      },
      {
        target: "api-keys-table",
        title: "Your keys",
        body: "Each key's name, its first few characters, when it expires and whether it's still active.",
      },
      {
        selector: 'button[title="Revoke key"]',
        title: "Revoke",
        body: "Click the bin to revoke a key. You'll be asked to confirm, and once revoked it stops working straight away.",
      },
    ],
  },
];
