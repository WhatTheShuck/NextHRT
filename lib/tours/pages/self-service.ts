import { who } from "../audience";
import type { PageTour } from "../types";

export const selfServiceTours: PageTour[] = [
  {
    id: "employees",
    version: 1,
    path: /^\/employees$/,
    title: "Employees",
    summary:
      "Find a person and open their records. Admins see everyone, managers see the people they look after, and everyone else sees just themselves.",
    tips: [
      { text: "Click anywhere on a row to open that person's records." },
      { text: "Click a column heading to sort by it. Click it again to reverse the order." },
      { text: "Turn off \"Active Only\" to find people who have left.", when: who.managerOrAdmin },
    ],
    steps: [
      {
        title: "Employee directory",
        body: "Everyone in HRT is listed here. Click a person to see their training, tickets, SOPs and history.",
        when: who.admin,
      },
      {
        title: "Employee directory",
        body: "The people you look after are listed here. Click a person to see their training, tickets and SOPs.",
        when: (a) => a.manager && !a.admin,
      },
      {
        title: "Your record",
        body: "You'll find yourself here. Click your name to see your own training, tickets and SOPs.",
        when: (a) => !a.manager && !a.admin,
      },
      {
        target: "employees-search",
        title: "Search",
        body: "Type a name, job title, department or location to narrow the list.",
      },
      {
        target: "employees-active-only",
        title: "Active Only",
        body: "While this is on, people who have left are hidden. Turn it off to see them too.",
        when: who.managerOrAdmin,
      },
      {
        target: "employees-add",
        title: "Add Employee",
        body: "Opens a form to add a new person to HRT.",
        when: who.admin,
      },
      {
        target: "employees-table",
        title: "Open a record",
        body: "Click anywhere on a row to open that person's records. Click a column heading to sort the list.",
      },
      {
        target: "employees-status",
        title: "Active or Inactive",
        body: "Green \"Active\" means the person still works here. Red \"Inactive\" means they've left.",
      },
    ],
  },
  {
    id: "employee-profile",
    version: 1,
    path: /^\/employees\/[^/]+$/,
    title: "Employee record",
    summary:
      "Everything HRT holds about one person, split into tabs: training, SOPs, tickets, exemptions and history.",
    tips: [
      {
        text: "Tickets show \"Valid\", \"Expiring Soon\" (within 30 days) or \"Expired\". Expired tickets are hidden until you turn on \"Include expired\".",
      },
      {
        text: "\"Update Needed\" on a training record means the training has changed since it was done, so it needs doing again.",
      },
      { text: "The History tab shows who changed this record, and when." },
    ],
    steps: [
      {
        target: "employee-header",
        title: "Who this is",
        body: "The person's name, job title and department. If they go by a different name, their legal name is shown underneath.",
      },
      {
        target: "employee-edit",
        title: "Edit Profile",
        body: "Change this person's details. You can now also set who they report to.",
        when: who.admin,
        isNew: true,
      },
      {
        target: "employee-tabs",
        title: "Tabs",
        body: "Each tab holds a different part of the record. Click a tab to open it.",
        when: who.nonAdmin,
      },
      {
        target: "employee-tabs",
        title: "Tabs",
        body: "Each tab holds a different part of the record. The Add, Edit, Renew and Delete buttons for records are inside the tabs.",
        when: who.admin,
      },
      {
        target: "employee-tab-user-link",
        title: "Admin-only tabs",
        body: "\"User Link\" connects this record to a sign-in account. \"Onboarding\" shows the new-starter request for this person.",
        when: who.admin,
      },
      {
        target: "employee-reports-to",
        title: "Reports To",
        body: "This person's manager. Click the name to open their record.",
        isNew: true,
      },
      {
        target: "employee-notes",
        title: "Notes",
        body: "Notes an administrator has added about this person.",
        when: who.nonAdmin,
      },
      {
        target: "employee-notes",
        title: "Notes",
        body: "Notes about this person. Click the pencil to edit them.",
        when: who.admin,
      },
    ],
  },
  {
    id: "my-sops",
    version: 1,
    path: /^\/my-sops$/,
    title: "My SOPs",
    summary:
      "The standard operating procedures (SOPs) your job needs. Read each one, answer its questions, and a trainer marks your answers.",
    tips: [
      { text: "You can stop part-way. Click \"Save draft\", then come back later with \"Resume\"." },
      { text: "\"Not available yet\" means the SOP hasn't been set up. You don't need to do anything." },
      { text: "If changes are requested, you only need to fix the answers your trainer marked." },
    ],
    steps: [
      {
        target: "my-sops-header",
        title: "My SOPs",
        body: "These are the SOPs needed for your department and location.",
      },
      {
        target: "my-sops-not-linked",
        title: "Account not linked",
        body: "An administrator needs to connect your sign-in to your employee record before your SOPs show here.",
        when: who.unlinked,
      },
      {
        target: "my-sops-empty",
        title: "Nothing to do",
        body: "No SOPs are needed for your job right now. They'll show up here if that changes.",
      },
      {
        target: "my-sops-task-sheet",
        title: "Task Sheet",
        body: "Shows \"Complete\" once you've confirmed you've read and understood the SOP.",
      },
      {
        target: "my-sops-practical",
        title: "Practical",
        body: "Shows \"Complete\" once a trainer has signed you off.",
      },
      {
        target: "my-sops-assessment",
        title: "Where you're up to",
        body: "\"In progress\" means you've started. \"Awaiting marking\" means a trainer has it. \"Changes requested\" means some answers need another go.",
      },
      {
        target: "my-sops-action",
        title: "What to do next",
        body: "Click \"Start\" to begin, \"Resume\" to carry on, or \"Fix answers\" if changes were asked for. \"View\" shows what you sent.",
      },
    ],
  },
  {
    id: "sop-assessment",
    version: 1,
    path: /^\/my-sops\/[^/]+$/,
    title: "SOP assessment",
    summary:
      "Read the procedure, confirm you've understood it, then answer the questions for a trainer to mark.",
    tips: [
      { text: "Click \"Save draft\" to keep your answers and finish later." },
      {
        text: "If changes are requested, you can only edit the answers marked Insufficient. Your trainer's notes are shown under each one.",
      },
      { text: "Once you've passed, click \"Export PDF\" to save a copy." },
    ],
    steps: [
      {
        target: "sop-assess-header",
        title: "This SOP",
        body: "The SOP's name, its version and where your assessment is up to.",
      },
      {
        target: "sop-assess-new-revision",
        title: "Newer version",
        body: "This SOP has changed since you started. Click \"Restart on current revision\" to start the new one. Your old answers will be cleared.",
      },
      {
        target: "sop-assess-pdf",
        title: "Read the procedure",
        body: "Read the whole procedure first. You can scroll inside this box.",
      },
      {
        target: "sop-assess-read",
        title: "Confirm you've read it",
        body: "Tick \"I have read and understood this SOP\" once you have. You can't submit until it's ticked.",
      },
      {
        target: "sop-assess-questions",
        title: "Answer the questions",
        body: "Type your answer under each question. After marking, each one shows \"Sufficient\" or \"Insufficient\".",
      },
      {
        target: "sop-assess-actions",
        title: "Save or submit",
        body: "Click \"Save draft\" to finish later. Click \"Submit for marking\" when every question is answered.",
      },
      {
        target: "sop-assess-export",
        title: "Download a copy",
        body: "You've passed. Click \"Export PDF\" to save a copy of your answers.",
      },
    ],
  },
  {
    id: "quiz-list",
    version: 1,
    path: /^\/quiz$/,
    title: "My questionnaires",
    summary: "Questionnaires you've been asked to fill in. They aren't marked, and you can stop part-way.",
    tips: [
      { text: "Your answers are saved as you go, so you can close the page and come back later." },
      { text: "Open a finished questionnaire to read its tips again." },
    ],
    steps: [
      {
        target: "quiz-header",
        title: "My questionnaires",
        body: "Everything you've been asked to fill in is listed here.",
      },
      {
        target: "quiz-empty",
        title: "All clear",
        body: "You have nothing to fill in right now. New questionnaires will show up here.",
      },
      {
        target: "quiz-item",
        title: "A questionnaire",
        body: "Each card shows the name and whether you've finished it. \"New version available\" means it changed after you started.",
      },
      {
        target: "quiz-action",
        title: "Start or carry on",
        body: "Click \"Start\" to begin, \"Resume\" to pick up where you left off, or \"Review\" to look back at one you've finished.",
      },
    ],
  },
  {
    id: "quiz-player",
    version: 1,
    path: /^\/quiz\/[^/]+$/,
    title: "Questionnaire",
    summary: "Answer one question at a time. Your answer is saved each time you move on.",
    tips: [
      { text: "Click \"Back\" to look at an earlier question." },
      { text: "Some questions show a tip once you've answered. You can't change those answers afterwards." },
    ],
    steps: [
      {
        target: "quiz-intro",
        title: "Not a test",
        body: "Answer honestly. There are no marks, and you'll pick up tips along the way.",
      },
      {
        target: "quiz-progress",
        title: "Progress",
        body: "Shows how many of the required questions you've answered.",
      },
      {
        target: "quiz-question",
        title: "The question",
        body: "Pick an option or type your answer.",
      },
      {
        target: "quiz-nav",
        title: "Move on",
        body: "Click \"Next\" (or \"Answer\") to save and move on. On the last question, click \"Submit\".",
      },
      {
        target: "quiz-submit-early",
        title: "Finish early",
        body: "You've answered every required question. Click \"Submit questionnaire\" to finish now, or carry on.",
      },
      {
        target: "quiz-restart",
        title: "New version",
        body: "This questionnaire changed after you started. Click \"Restart on the current version\" to take the new one.",
      },
      {
        target: "quiz-done",
        title: "All done",
        body: "You've finished this questionnaire. Come back any time to read your tips again.",
      },
    ],
  },
  {
    id: "access-check",
    version: 1,
    path: /^\/access-check$/,
    title: "Who can see data",
    summary:
      "Shows everyone who can open an employee record in HRT, and why. You see your own record; admins can check anyone's.",
    tips: [
      {
        text: "If someone is listed who you don't think should be, contact an administrator.",
        when: who.nonAdmin,
      },
      {
        text: "The badge next to each person says why they have access, such as \"Line Manager\" or \"View only\".",
      },
      {
        text: "Use the Access Reports at the bottom to check everyone at once, or one department or location.",
        when: who.admin,
      },
    ],
    steps: [
      {
        target: "access-header",
        title: "Who can see your data",
        body: "This page lists everyone who can open your employee record in HRT.",
        when: who.nonAdmin,
      },
      {
        target: "access-header",
        title: "Access Check",
        body: "Pick any employee to see who can open their record, and why.",
        when: who.admin,
      },
      {
        target: "access-not-linked",
        title: "Account not linked",
        body: "An administrator needs to connect your sign-in to your employee record before this page can show anything.",
        when: who.unlinked,
      },
      {
        target: "access-employee-picker",
        title: "Choose an employee",
        body: "Type a name and pick the person you want to check.",
        when: who.admin,
      },
      {
        target: "access-include-inactive",
        title: "Include inactive",
        body: "Turn this on to find people who have left.",
        when: who.admin,
      },
      {
        target: "access-summary",
        title: "The record",
        body: "The person's name, department and location, and how many people can see their record.",
      },
      {
        target: "access-cards",
        title: "Grouped by reason",
        body: "People are grouped by why they have access: admins, managers, and the person's own sign-in.",
      },
      {
        selector: '[data-tour="access-cards"] > :nth-child(2)',
        title: "Managers",
        body: "People who can see the record through the reporting line. The badge says how, such as \"Dept Manager\", \"Line Manager\", \"Delegated\" or \"View only\".",
        isNew: true,
      },
      {
        target: "access-reports",
        title: "Access reports",
        body: "Check who can see everyone's records at once, or one department or location at a time.",
        when: who.admin,
      },
    ],
  },
  {
    id: "sop-reviews",
    version: 1,
    path: /^\/sop-reviews$/,
    title: "SOP Reviews",
    summary: "SOP assessments waiting for you to mark. You only see SOPs you're a designated trainer for.",
    tips: [
      { text: "The oldest submission is at the top." },
      { text: "The person is told when you pass their assessment or ask for changes." },
    ],
    steps: [
      {
        target: "sop-reviews-header",
        title: "SOP Reviews",
        body: "Submitted SOP answers waiting for your mark appear here.",
      },
      {
        target: "sop-reviews-empty",
        title: "Nothing to mark",
        body: "No one is waiting on you. You only see SOPs you're a trainer for, so if you think one is missing, contact an administrator.",
      },
      {
        target: "sop-reviews-table",
        title: "The queue",
        body: "Each row is one person's answers for one SOP, oldest first.",
      },
      {
        target: "sop-reviews-mark",
        title: "Mark",
        body: "Click \"Mark\" to read the answers and give your verdict.",
      },
    ],
  },
  {
    id: "sop-marking",
    version: 1,
    path: /^\/sop-reviews\/[^/]+$/,
    title: "Marking an SOP",
    summary: "Check each answer against the procedure, then pass the assessment or send it back for changes.",
    tips: [
      { text: "Your note on an Insufficient answer is shown to the employee." },
      { text: "When you ask for changes, the employee can only edit the answers you marked Insufficient." },
      { text: "Passing signs off the Practical for this SOP on the person's record." },
    ],
    steps: [
      {
        target: "sop-mark-header",
        title: "Who and what",
        body: "The SOP, its version and the person whose answers you're marking.",
      },
      {
        target: "sop-mark-old-revision",
        title: "Older version",
        body: "These answers are for an older version of the SOP. You can still pass them, but the person may need to redo the new version.",
      },
      {
        target: "sop-mark-pdf",
        title: "The procedure",
        body: "The SOP itself, so you can check the answers against it.",
      },
      {
        target: "sop-mark-answer",
        title: "Their answer",
        body: "Each question shows the person's answer. Where there's a \"What good looks like\" note, use it to judge the answer.",
      },
      {
        target: "sop-mark-verdict",
        title: "Sufficient or not",
        body: "Mark every answer \"Sufficient\" or \"Insufficient\". For Insufficient, add a note saying what needs to change.",
      },
      {
        target: "sop-mark-actions",
        title: "Finish marking",
        body: "Click \"Pass\" when every answer is Sufficient. If any answer is Insufficient, click \"Request changes\" to send it back.",
      },
    ],
  },
];
