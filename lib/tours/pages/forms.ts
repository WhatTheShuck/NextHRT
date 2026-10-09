import { who } from "../audience";
import type { PageTour } from "../types";

export const formsTours: PageTour[] = [
  {
    id: "forms",
    version: 1,
    path: /^\/forms$/,
    title: "Forms",
    summary: "Request training, start a new employee, and keep track of the requests you've made.",
    tips: [
      { text: "You'll only see the forms that apply to you." },
      { text: "Open My Requests to see where your training requests are up to." },
    ],
    steps: [
      {
        target: "forms-my-requests",
        title: "My Requests",
        body: "See every training request you've made, or that someone made for you, and where each one is up to.",
      },
      {
        target: "card:/forms/training-request",
        title: "Request training",
        body: "Ask for a training course for yourself or someone else. It's then sent off for approval.",
      },
      {
        target: "card:/forms/new-employee",
        title: "New employee",
        body: "Starting someone new? Fill this in and an admin will check it, then create their employee record.",
        when: who.managerOrAdmin,
      },
    ],
  },
  {
    id: "training-request",
    version: 1,
    path: /^\/forms\/training-request$/,
    title: "Request training",
    summary: "Ask for a training course for yourself or someone else. It goes to an approver, and you can follow it in My Requests.",
    tips: [
      { text: "Fields marked * must be filled in before you can submit." },
      { text: "Can't find the course? Click + next to the course list to ask for a new one." },
      {
        text: "To request training for yourself, your sign-in needs to be connected to your employee record. Ask an administrator.",
        when: who.unlinked,
      },
    ],
    steps: [
      {
        target: "training-request-employee",
        title: "Who it's for",
        body: "Your name is filled in for you. To request training for someone else, tick \"Submit on behalf of someone else\" and pick them.",
      },
      {
        target: "training-request-course",
        title: "Pick the course",
        body: "Search for the course you need. If it isn't listed, click + to ask for a new course to be added.",
      },
      {
        target: "training-request-justification",
        title: "Why it's needed",
        body: "A short reason for doing this training. Your approver reads this.",
      },
      {
        target: "training-request-cost",
        title: "Estimated cost",
        body: "Your best guess of the cost in dollars. Enter 0 if it's free.",
      },
      {
        target: "training-request-hours",
        title: "How long it takes",
        body: "How many hours the training runs for, such as 8 for a full day.",
      },
      {
        target: "training-request-approver",
        title: "Your approver",
        body: "We suggest who should approve it, such as your manager or their manager. Pick one, or click \"Choose a different approver\" to name someone else.",
        isNew: true,
      },
      {
        target: "training-request-dates",
        title: "Dates",
        body: "When the training starts. Below it, add the date you expect to finish.",
      },
      {
        target: "training-request-submit",
        title: "Send it off",
        body: "Click Submit Request when you're done. You'll then see a page where you can follow its progress.",
      },
    ],
  },
  {
    id: "training-request-status",
    version: 1,
    path: /^\/forms\/training-request\/\d+$/,
    title: "Training request",
    summary: "Where a training request is up to, who has decided on it so far, and what they said.",
    tips: [
      { text: "You can only cancel a request you submitted, and only while it's still pending." },
      { text: "Find all your requests again under Forms, then My Requests." },
    ],
    steps: [
      {
        target: "request-status",
        title: "Status",
        body: "Pending means it's still waiting on someone. Approved and Rejected are final. Cancelled means it was withdrawn.",
      },
      {
        target: "request-course-warning",
        title: "New course",
        body: "This request is for a course that isn't in HRT yet. An admin needs to sort that out before it can be fully approved.",
      },
      {
        target: "request-summary",
        title: "What was asked for",
        body: "The details sent with the request, including the approver if one was picked.",
      },
      {
        target: "request-stages",
        title: "Approval steps",
        body: "It goes to the Manager first, then the HR Manager, then an admin. A tick or cross shows each decision, and the highlighted clock shows where it's waiting.",
        isNew: true,
      },
      {
        target: "request-history",
        title: "Decisions so far",
        body: "Who approved or rejected it, when, and any comment they left.",
      },
      {
        target: "request-cancel",
        title: "Changed your mind?",
        body: "Click Cancel Request to withdraw it. This can't be undone.",
      },
    ],
  },
  {
    id: "my-requests",
    version: 1,
    path: /^\/forms\/my-requests$/,
    title: "My Requests",
    summary: "Training requests you've made, and ones other people made for you, with where each one is up to.",
    tips: [
      { text: "Click a column heading with arrows to sort by it." },
      { text: "Choose \"Submitted for me\" to see training someone else asked for on your behalf." },
    ],
    steps: [
      {
        target: "my-requests-status-filter",
        title: "Filter by status",
        body: "Show only Pending, Approved, Rejected or Cancelled requests.",
      },
      {
        target: "my-requests-perspective-filter",
        title: "Whose requests",
        body: "\"Submitted by me\" shows requests you made, even for other people. \"Submitted for me\" shows training requested for you.",
      },
      {
        target: "my-requests-status",
        title: "Status",
        body: "Pending means it's still waiting on someone. Approved and Rejected are final. Cancelled means it was withdrawn.",
      },
      {
        target: "my-requests-stage",
        title: "Stage",
        body: "Who it's waiting on: Manager, HR Manager or Admin. It says Completed once it's fully approved.",
        isNew: true,
      },
      {
        target: "my-requests-open",
        title: "Open a request",
        body: "Click here to see the full details and every decision, or to cancel it.",
      },
    ],
  },
  {
    id: "new-employee",
    version: 1,
    path: /^\/forms\/new-employee$/,
    title: "New employee",
    summary: "Tell HRT about someone who's starting. An admin reviews the form, then creates their employee record.",
    tips: [
      { text: "Fields marked * must be filled in before you can submit." },
      { text: "If the name matches someone already in HRT, you'll see a warning. The reviewer checks it so there's no duplicate." },
    ],
    steps: [
      {
        target: "onboarding-details",
        title: "Employee details",
        body: "The new person's name, job title, manager, department, location and start date.",
      },
      {
        target: "onboarding-new-department",
        title: "Missing department?",
        body: "If the department or location isn't listed, click + next to it to add or request a new one.",
      },
      {
        target: "onboarding-compliance",
        title: "Forms and compliance",
        body: "Checks needed before they start, like the police check and medical. Some are filled in for you based on the job, so check them.",
      },
      {
        target: "onboarding-software",
        title: "Software access",
        body: "Tick the programs they'll need. Some ask you to pick a reference user: someone who already has similar access.",
      },
      {
        target: "onboarding-hardware",
        title: "Hardware",
        body: "Tick the equipment they'll need. Some items ask a few more questions once ticked.",
      },
      {
        target: "onboarding-notes",
        title: "Notes for each team",
        body: "Optional notes for IT, HR and Payroll. They're added to the emails each team receives.",
      },
      {
        target: "onboarding-submit",
        title: "Send it for review",
        body: "Click Submit Onboarding Request when you're done. An admin reviews it and creates the employee record once it's approved.",
      },
    ],
  },
  {
    id: "approvals",
    version: 1,
    path: /^\/approvals$/,
    title: "Approvals",
    summary: "Training requests waiting for your decision. You only see the ones you're allowed to decide.",
    tips: [
      { text: "Nobody can approve a request about themselves. Your own requests go to your manager." },
      { text: "A comment is needed when you reject a request." },
      { text: "As an admin you see every pending request, at every step, apart from your own.", when: who.admin },
    ],
    steps: [
      {
        target: "approvals-intro",
        title: "Your approvals",
        body: "Requests waiting for you. You'll only see ones you're allowed to decide, and never a request about yourself.",
        isNew: true,
      },
      {
        target: "approvals-empty",
        title: "Nothing waiting",
        body: "You're all caught up. New requests will show up here when they need you.",
      },
      {
        target: "approvals-request",
        title: "A request",
        body: "Shows who it's for, the course and which step it's at. Click it to open the details and decide.",
      },
      {
        target: "approvals-delegate-notice",
        title: "Deciding for someone",
        body: "You've been given access to decide for another manager. They'll see that it was you.",
        isNew: true,
      },
      {
        target: "approvals-admin-notice",
        title: "Stepping in",
        body: "This person isn't in your reporting line, so you're deciding as an admin. You must leave a comment.",
        when: who.admin,
        isNew: true,
      },
      {
        target: "approvals-decision",
        title: "Approve or reject",
        body: "Pick one. Nothing is saved until you click Submit Decision.",
      },
      {
        target: "approvals-comment",
        title: "Comment",
        body: "A note for the person who asked. It's required when you reject, or when the request named a different approver.",
      },
      {
        target: "approvals-submit",
        title: "Submit Decision",
        body: "Saves your decision. An approved request moves on to the next step. A rejected one stops there.",
      },
    ],
  },
  {
    id: "required-training",
    version: 1,
    path: /^\/required-training$/,
    title: "Training I Deliver",
    summary: "People who still need a course that's run in-house. Record their completion here once they've done it.",
    when: who.admin,
    tips: [
      { text: "Choose which courses appear here in App Settings, under Training." },
      { text: "Bulk Training has been removed. Record training here, or on the employee's own page." },
    ],
    steps: [
      {
        target: "required-training-setup",
        title: "Choose your courses",
        body: "No courses are picked yet. Choose the ones you deliver in App Settings, under Training, and they'll show here.",
      },
      {
        target: "required-training-empty",
        title: "All caught up",
        body: "Everyone has done the courses on this list. People will appear here when they need one.",
      },
      {
        target: "required-training-intro",
        title: "Training I Deliver",
        body: "Everyone who still needs one of these courses. With Bulk Training gone, this is a quick place to record training.",
        isNew: true,
      },
      {
        target: "required-training-grid",
        title: "People and courses",
        body: "One row per person, one column per course. A tick means done and a dash means they don't need it.",
      },
      {
        target: "required-training-new-starter",
        title: "New starter",
        body: "A star marks someone who joined through the New Employee form. They're listed first.",
      },
      {
        target: "required-training-record",
        title: "Record it",
        body: "Click + once someone has done the course. Check the date and trainer, then click Record Completion.",
      },
    ],
  },
];
