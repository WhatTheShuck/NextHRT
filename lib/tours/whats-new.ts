import { who } from "./audience";
import type { Audience, WhatsNewItem, WhatsNewRelease } from "./types";

/**
 * Shown once, as a popup, to people who were using HRT before this release.
 * People who sign in for the first time after it get the page tours instead.
 *
 * For the next release: give it a new `id` and replace the items. Everyone
 * who used HRT before that release is deployed sees it once.
 */
export const currentRelease: WhatsNewRelease = {
  id: "2026-10",
  title: "What's new in HRT",
  items: [
    {
      group: "everyone",
      title: "Search from anywhere",
      body: "Use the search box at the top of every page, or press Ctrl+K, to jump to a page, find a person or run a quick action.",
    },
    {
      group: "everyone",
      title: "A help button on every page",
      body: "Click the ? button in the bottom corner for tips about the page you're on, or to be walked through it step by step.",
    },
    {
      group: "everyone",
      title: "Upload your tickets and certificates",
      body: "Take a photo of a ticket, licence or external training certificate and upload it. An admin checks it and adds it to your records, or sends it back with a reason.",
      when: who.linked,
      href: "/forms/document-upload",
    },
    {
      group: "everyone",
      title: "See what's expiring or missing",
      body: "Expiring & Missing lists your tickets that are about to expire or have expired, and any tickets or training you still need, so you can upload a new copy in time.",
      when: who.linked,
      href: "/expiring",
    },
    {
      group: "everyone",
      title: "Pick up questionnaires where you left off",
      body: "If you stop part-way through a questionnaire, it now opens back up at the first question you haven't answered.",
      when: who.linked,
      href: "/quiz",
    },
    {
      group: "everyone",
      title: "Training requests suggest your approver",
      body: "The training request form now suggests who should approve your request. The first approval step is now called \"Manager\" instead of \"Department Manager\".",
      when: who.linked,
      href: "/forms/training-request",
    },
    {
      group: "managers",
      title: "See who in your team has signed in",
      body: "Your dashboard shows which of your people haven't signed in to HRT yet, with a reminder message you can copy and send them.",
      when: who.manager,
      href: "/",
    },
    {
      group: "managers",
      title: "Upload documents for your team",
      body: "You can upload a ticket or certificate on behalf of someone in your team, and see what's expiring or missing for them.",
      when: who.manager,
      href: "/expiring",
    },
    {
      group: "managers",
      title: "Approvals only show what you can decide",
      body: "You'll only see requests you're allowed to approve, and nobody can approve a request about themselves. Your own requests go to your manager.",
      when: who.managerOrAdmin,
      href: "/approvals",
    },
    {
      group: "admins",
      title: "Admin tools are grouped",
      body: "User Permissions, Org Chart and API Keys are under Users & Access. App Settings, Background Jobs and Admin Logs are under System. Email Templates are under Email.",
      when: who.admin,
      href: "/",
    },
    {
      group: "admins",
      title: "Review uploaded documents",
      body: "People can now upload their own tickets and certificates. Open Document Reviews to check each one, then approve it into their records or send it back with a reason.",
      when: who.admin,
      href: "/expiring?tab=review",
    },
    {
      group: "admins",
      title: "Email log and missing attachments",
      body: "See every email HRT has sent, queued or failed to send, and retry or cancel it. Onboarding emails whose form files have gone missing can be resent from one place.",
      when: who.admin,
      href: "/admin/email",
    },
    {
      group: "admins",
      title: "IT induction questionnaire editor",
      body: "Edit the IT induction questionnaire in a visual editor, from Questionnaires, then Edit questions. This replaces the questionnaire section of the training edit dialog; other training keeps its questions in its SOP.",
      when: who.admin,
      href: "/admin/quiz-results",
    },
    {
      group: "admins",
      title: "Workday import and reporting lines",
      body: "Upload the Workday org chart, review each suggested change and apply only the ones you tick. The Org Chart has a Reporting lines view, and employee profiles have a Reports To field.",
      when: who.admin,
      href: "/admin/org-chart/import",
    },
    {
      group: "admins",
      title: "Getting ready for line-manager authority",
      body: "Give people view or act access to a manager's team, and check the switch-over readiness report. Nothing changes for anyone until you switch it on.",
      when: who.admin,
      href: "/admin/org-chart/switchover",
    },
    {
      group: "admins",
      title: "Unlinked sign-ins are easier to spot",
      body: "Users & Access shows how many people are waiting to be linked, the mapping table has an \"Unlinked only\" filter, and a Monday email lists anyone still waiting. People are emailed when their account is linked.",
      when: who.admin,
      href: "/admin/access",
    },
    {
      group: "admins",
      title: "Bulk Training has been removed",
      body: "It couldn't create records. Record training on the employee's profile, or from Required Training for courses you deliver yourself.",
      when: who.admin,
      href: "/required-training",
    },
  ],
};

export function whatsNewItemsFor(
  release: WhatsNewRelease,
  audience: Audience,
): WhatsNewItem[] {
  return release.items.filter((i) => !i.when || i.when(audience));
}
