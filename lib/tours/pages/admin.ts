import type { PageTour } from "../types";

/** Admin tools: Email, System, Dropdown Items, Questionnaires and Onboarding. */
export const adminTours: PageTour[] = [
  // ─── Email ────────────────────────────────────────────────────────────────
  {
    id: "admin-email",
    version: 1,
    path: /^\/admin\/email$/,
    title: "Email",
    summary: "Everything about the emails HRT sends: their wording, what has been sent, and fixing ones that didn't go out.",
    tips: [
      { text: "A red number on a card means something there needs a look." },
      { text: "Old links to Email Templates still work. They bring you to Templates here." },
    ],
    steps: [
      {
        target: "card:/admin/email/templates",
        title: "Templates",
        body: "Change the wording of every automatic email. You can preview it or send yourself a test first.",
      },
      {
        target: "card:/admin/email/log",
        title: "Email Log",
        body: "Every email HRT has sent, queued or failed to send. The red number counts failed emails.",
        isNew: true,
      },
      {
        target: "card:/admin/email/attachments",
        title: "Missing Attachments",
        body: "Onboarding emails whose form files have gone missing. Resend them from here once the forms are back.",
        isNew: true,
      },
      {
        target: "email-stats",
        title: "At a glance",
        body: "Emails sent in the last 7 days, waiting to go, failed, and waiting on missing attachments. Red numbers need a look.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-email-log",
    version: 1,
    path: /^\/admin\/email\/log$/,
    title: "Email Log",
    summary: "Every email HRT has sent, queued or failed to send. Open one to read it, retry it or cancel it.",
    tips: [
      { text: "Test sends from Templates aren't listed here. You'll find them in Admin Logs." },
      { text: "If an attachment says \"missing on server\", retrying will fail again. Resend it from Missing Attachments instead." },
      { text: "Click Refresh to check for new emails." },
    ],
    steps: [
      {
        target: "email-log-filters",
        title: "Filter by status",
        body: "Show all emails, or only the Sent, Queued, Failed or Cancelled ones.",
        isNew: true,
      },
      {
        target: "email-log-search",
        title: "Search",
        body: "Find an email by who it went to or its subject.",
      },
      {
        target: "email-log-list",
        title: "Open an email",
        body: "Click an email to see who it went to, the full message and its attachments. Failed emails show the error in red.",
      },
      {
        title: "Retry or cancel",
        body: "In an email's details, Retry sends a failed or cancelled email again. Cancel send stops a queued one going out.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-email-attachments",
    version: 1,
    path: /^\/admin\/email\/attachments$/,
    title: "Missing Attachments",
    summary: "Onboarding emails whose attached forms no longer exist on the server. Resend them with the forms that are uploaded now.",
    tips: [
      { text: "Upload the forms in App Settings, on the Onboarding tab." },
      { text: "Resent emails show up in the Email Log." },
      { text: "If nothing is listed, every waiting email has its attachments." },
    ],
    steps: [
      {
        target: "missing-uploads",
        title: "Re-upload first",
        body: "Some uploaded forms are missing too. Remove and re-upload them in App Settings › Onboarding before you resend.",
      },
      {
        target: "stale-emails",
        title: "Waiting emails",
        body: "Each email shows which files are missing and which forms it will attach now. Click Resend to send just that one.",
        isNew: true,
      },
      {
        target: "resend-all",
        title: "Resend all",
        body: "Sends every email in the list again with the current forms. The wording and calendar invite stay the same.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-email-templates",
    version: 1,
    path: /^\/admin\/email\/templates$/,
    title: "Email Templates",
    summary: "Change the wording of every automatic email HRT sends. Changes apply from the next send.",
    tips: [
      { text: "The preview and test send use what's on screen. Real emails use the saved version." },
      { text: "Advanced holds the shared layout and the row formats used for lists inside other emails." },
      { text: "Every save is kept in History, so you can always go back." },
    ],
    steps: [
      {
        target: "email-template-list",
        title: "Pick an email",
        body: "Emails are grouped by purpose, such as Onboarding, Documents and Accounts. Badges show if one is edited, switched off or not written yet.",
        isNew: true,
      },
      {
        target: "email-template-active",
        title: "On or off",
        body: "Switch an email off to stop it being sent. Everything else about its job still runs.",
      },
      {
        target: "email-template-tabs",
        title: "Edit and Preview",
        body: "Change the subject and body on Edit. Open Preview to see how the email will look.",
      },
      {
        target: "email-template-body",
        title: "Body",
        body: "Write the email here. Use Insert field to add details, like a name, that are filled in for each email.",
      },
      {
        target: "email-template-actions",
        title: "Save and test",
        body: "Save changes when you're happy. Send test to me emails you a copy. History and Revert to default undo changes.",
      },
    ],
  },

  // ─── System ───────────────────────────────────────────────────────────────
  {
    id: "admin-system",
    version: 1,
    path: /^\/admin\/system$/,
    title: "System",
    summary: "App settings and the background workings of HRT: scheduled jobs and system logs.",
    steps: [
      {
        title: "System",
        body: "App Settings, Background Jobs and Admin Logs have moved here from the dashboard.",
        isNew: true,
      },
      {
        target: "card:/admin/settings",
        title: "App Settings",
        body: "Sign-in matching, onboarding links and forms, the training you deliver, change history and themes.",
      },
      {
        target: "card:/admin/jobs",
        title: "Background Jobs",
        body: "See the jobs HRT runs on a timetable, run one now, and retry or cancel jobs.",
      },
      {
        target: "card:/admin/logs",
        title: "Admin Logs",
        body: "System messages, warnings and errors. Check here when something didn't happen as expected.",
      },
    ],
  },
  {
    id: "admin-settings",
    version: 1,
    path: /^\/admin\/settings$/,
    title: "App Settings",
    summary: "Settings for how HRT behaves for everyone, split into tabs.",
    tips: [
      { text: "Each tab has its own Save button. Switching tabs keeps your changes, but they aren't saved until you click it." },
      { text: "You can link straight to a tab, for example /admin/settings?tab=onboarding." },
    ],
    steps: [
      {
        target: "settings-tab-matching",
        title: "Matching",
        body: "Rules for suggesting which employee a sign-in belongs to: by email address, exact name or a close name.",
      },
      {
        target: "settings-tab-onboarding",
        title: "Onboarding",
        body: "Links and email recipients for onboarding, and the forms attached to onboarding emails.",
      },
      {
        target: "settings-compliance",
        title: "Missing forms",
        body: "Forms that have gone missing from the server are marked here. Remove and re-upload them, then resend from Email › Missing Attachments.",
        isNew: true,
      },
      {
        target: "settings-tab-training",
        title: "Training I Deliver",
        body: "Tick the courses you deliver yourself. Only these appear on your Required Training tracker.",
      },
      {
        target: "settings-tab-history",
        title: "Change History",
        body: "Every settings change: the old value, the new value, who changed it and when.",
      },
      {
        target: "settings-tab-themes",
        title: "Themes",
        body: "Set the default colour theme, add company themes, or lock the theme so people can't change it.",
      },
    ],
  },
  {
    id: "admin-jobs",
    version: 1,
    path: /^\/admin\/jobs$/,
    title: "Background Jobs",
    summary: "The work HRT does behind the scenes, such as sending emails and reminders. See what ran, and fix what failed.",
    tips: [
      { text: "Failed emails can also be retried from Email › Email Log." },
    ],
    steps: [
      {
        target: "jobs-scheduled",
        title: "Scheduled jobs",
        body: "Jobs HRT runs on a timetable. Click Run now to run one straight away.",
      },
      {
        target: "jobs-history",
        title: "Job history",
        body: "Every job that has run or is waiting. Filter by status or type, retry failed jobs, or cancel pending ones.",
      },
      {
        target: "jobs-archival",
        title: "History archival",
        body: "Shows how many old history records are past the retention period. Run archival now deletes them for good.",
      },
    ],
  },
  {
    id: "admin-logs",
    version: 1,
    path: /^\/admin\/logs$/,
    title: "Admin Logs",
    summary: "System messages, warnings and errors from HRT.",
    tips: [
      { text: "Test sends from Email Templates are recorded here." },
      { text: "Click Refresh to load new messages." },
    ],
    steps: [
      {
        title: "Admin Logs",
        body: "Check here when something didn't happen as expected.",
      },
      {
        target: "logs-severity",
        title: "Filter by level",
        body: "Show all messages, or only Info, Warning or Error.",
      },
      {
        target: "logs-list",
        title: "Messages",
        body: "Each message shows its level, where it came from and when it happened.",
      },
    ],
  },

  // ─── Dropdown Items ───────────────────────────────────────────────────────
  {
    id: "admin-field-editor",
    version: 1,
    path: /^\/admin\/field-editor$/,
    title: "Dropdown Items",
    summary: "The lists people pick from across HRT, such as departments, locations, courses and tickets.",
    tips: [
      { text: "If an item is no longer needed, mark it inactive. It stays on old records but can't be picked." },
    ],
    steps: [
      {
        title: "Dropdown Items",
        body: "Each card edits one list that people pick from in HRT.",
      },
      {
        target: "card:/admin/field-editor/training",
        title: "Training",
        body: "Training courses, their revisions and who needs them. Questionnaires are now edited from Questionnaires on the dashboard.",
        isNew: true,
      },
      {
        target: "card:/admin/field-editor/sops",
        title: "SOPs",
        body: "Procedures, their questions and the trainers who mark them.",
      },
      {
        target: "card:/admin/field-editor/job-families",
        title: "Job Families",
        body: "Each job family sets what's filled in on the new employee form, like a laptop or licence.",
      },
      {
        target: "card:/admin/field-editor/programs",
        title: "Onboarding lists",
        body: "Software Programs, Hardware and Medical Standards are the choices offered on the new employee form.",
      },
      {
        target: "field-editor-stats",
        title: "Quick stats",
        body: "How many items each list has, and how many are active.",
      },
    ],
  },
  {
    id: "admin-field-editor-sops",
    version: 1,
    path: /^\/admin\/field-editor\/sops$/,
    title: "SOPs",
    summary: "Every SOP, whether it's ready to be taken, and who trains it.",
    tips: [
      { text: "SOPs with training records or assessments can't be deleted. Mark them inactive instead." },
      { text: "Trainers mark submitted assessments in SOP Reviews." },
    ],
    steps: [
      {
        target: "fe-add",
        title: "Add SOP",
        body: "Each SOP is one Task Sheet plus one Practical assessment.",
      },
      {
        target: "fe-search",
        title: "Search",
        body: "Type to find an SOP. Use the dropdowns beside it to filter by setup or status.",
      },
      {
        target: "fe-sop-setup",
        title: "Needs setup",
        body: "Pick Needs setup to find SOPs that can't be taken yet. Each one needs a revision, a procedure PDF, questions and a trainer.",
      },
      {
        target: "fe-table",
        title: "Trainers",
        body: "The Trainers column shows how many trainers each SOP has. A warning sign means one of them has no login.",
      },
      {
        target: "fe-table",
        title: "Assign trainers",
        body: "Click Edit on an SOP, then add people under Designated trainers. They need an HRT login to get notified and mark assessments.",
      },
    ],
  },
  {
    id: "admin-field-editor-training",
    version: 1,
    path: /^\/admin\/field-editor\/training$/,
    title: "Training",
    summary: "Every training course, its revisions and who needs it.",
    tips: [
      { text: "Courses with training records can't be deleted. Mark them inactive instead." },
      { text: "SOPs have their own list under Dropdown Items › SOPs." },
    ],
    steps: [
      {
        target: "fe-add",
        title: "Add a course",
        body: "Click Add Training Course to set up a new course.",
      },
      {
        target: "fe-search",
        title: "Search and filter",
        body: "Search by title or category, or use the dropdowns to filter by category and status.",
      },
      {
        target: "fe-table",
        title: "Edit a course",
        body: "Click Edit to change a course's details, requirements and revisions.",
      },
      {
        title: "Questionnaires have moved",
        body: "The Edit dialog no longer has a questionnaire section. Open Questionnaires from the dashboard and click Edit questions.",
        isNew: true,
      },
    ],
  },
  {
    id: "admin-field-editor-list",
    version: 1,
    path: /^\/admin\/field-editor\/(departments|locations|tickets|job-families|medical-standards|programs|hardware)$/,
    title: "Editing a list",
    summary: "Add, change or remove the items in one of HRT's dropdown lists.",
    tips: [
      { text: "If an item is no longer needed, mark it inactive in its Edit dialog." },
      { text: "Click a column heading to sort by it." },
    ],
    steps: [
      {
        target: "fe-add",
        title: "Add an item",
        body: "Click here to add a new item to this list.",
      },
      {
        target: "fe-hardware-sync",
        title: "Sync from AssetCheckout",
        body: "Pull the requestable categories from AssetCheckout and match them against this catalogue.",
      },
      {
        target: "fe-search",
        title: "Search and filter",
        body: "Type to narrow the list. Use the dropdown beside it to show only active or inactive items.",
      },
      {
        target: "fe-table",
        title: "Edit or delete",
        body: "Click Edit on a row to change it. If Delete is greyed out, the item is in use, so mark it inactive instead.",
      },
    ],
  },

  // ─── Questionnaires ───────────────────────────────────────────────────────
  {
    id: "admin-questionnaires",
    version: 1,
    path: /^\/admin\/quiz-results$/,
    title: "Questionnaires",
    summary: "Edit questionnaire questions, and read people's completed answers before their IT intro.",
    tips: [
      { text: "Nothing here is graded. Each summary shows where a tip would help." },
    ],
    steps: [
      {
        target: "questionnaire-list",
        title: "Questionnaires",
        body: "Every questionnaire in HRT. Inactive ones are marked.",
        isNew: true,
      },
      {
        target: "questionnaire-edit",
        title: "Edit questions",
        body: "Opens the questionnaire editor, where you change sections and questions.",
        isNew: true,
      },
      {
        target: "responses-filter",
        title: "Pick a questionnaire",
        body: "Show the responses to just one questionnaire.",
      },
      {
        target: "responses-list",
        title: "Completed responses",
        body: "Everyone who has finished a questionnaire. Click a name to see their summary.",
      },
    ],
  },
  {
    id: "admin-questionnaire-response",
    version: 1,
    path: /^\/admin\/quiz-results\/\d+$/,
    title: "Questionnaire response",
    summary: "One person's completed questionnaire, summarised so you can prepare for their IT intro.",
    tips: [
      { text: "A section only appears if the questionnaire asked that kind of question." },
    ],
    steps: [
      {
        target: "response-setup",
        title: "Work setup",
        body: "Their answers to the questions that decided which sections they saw.",
      },
      {
        target: "response-topics",
        title: "Things to cover",
        body: "Topics worth going through with them, based on their answers.",
      },
      {
        target: "response-flagged",
        title: "Where a tip would help",
        body: "Questions where they chose a slower way. You'll see their answer, the time-saver and the tip.",
      },
      {
        target: "response-self",
        title: "Self-assessment",
        body: "How they rated themselves on each rating scale.",
      },
      {
        target: "response-text",
        title: "In their words",
        body: "Anything they typed in their own words.",
      },
    ],
  },
  {
    id: "admin-questionnaire-editor",
    version: 1,
    path: /^\/admin\/quiz-editor\/\d+$/,
    title: "Questionnaire editor",
    summary: "Build the questions for a training's questionnaire. Each training revision has its own copy.",
    tips: [
      { text: "To branch, add a Single choice question in an earlier section." },
      { text: "Saved answers are linked to each question, so rewording a question keeps its answers." },
      { text: "For bigger changes, add a new revision in the training's Edit dialog. It copies the questionnaire forward." },
    ],
    steps: [
      {
        target: "quiz-revision",
        title: "Revision",
        body: "Pick which revision to edit. The one marked (current) is what people get the next time they open it.",
        isNew: true,
      },
      {
        target: "quiz-remove",
        title: "Remove questionnaire",
        body: "Deletes the questionnaire from this revision. This button goes away once anyone has answered it.",
      },
      {
        target: "quiz-has-responses",
        title: "Already answered",
        body: "People have answered this revision, so it can't be removed. Stick to wording fixes here.",
      },
      {
        target: "quiz-start",
        title: "Start a questionnaire",
        body: "This revision has no questionnaire yet. Click here to start one.",
      },
      {
        target: "quiz-tabs",
        title: "Visual or JSON",
        body: "Visual is the easy way to edit. JSON shows the raw content, for bulk edits.",
        isNew: true,
      },
      {
        target: "quiz-section",
        title: "Sections",
        body: "Name each section and move it with the arrows. Use \"Show this section\" to show it to everyone, or only to people who gave certain answers.",
        isNew: true,
      },
      {
        target: "quiz-question",
        title: "Questions",
        body: "Click a question to open it. Use the arrows to move it up or down, or the bin to delete it.",
      },
      {
        target: "quiz-add-question",
        title: "Add question",
        body: "Pick Information, Single choice, Rating scale, Pick any or Free text. Single choice can have a right answer and a tip.",
      },
      {
        selector: "[data-bottom-bar]",
        title: "Save",
        body: "Nothing is saved until you click Save. Anything that needs fixing first is listed here.",
        side: "top",
      },
    ],
  },

  // ─── Onboarding ───────────────────────────────────────────────────────────
  {
    id: "admin-onboarding",
    version: 1,
    path: /^\/admin\/onboarding$/,
    title: "Onboarding Requests",
    summary: "New employee forms sent in by managers, waiting for you to approve or reject.",
    tips: [
      { text: "Approving a request sends the onboarding emails. You can follow them in Email › Email Log." },
    ],
    steps: [
      {
        title: "Onboarding Requests",
        body: "When a manager fills in the New Employee Form, it lands here for you to review.",
      },
      {
        target: "onboarding-status-filter",
        title: "Filter by status",
        body: "Show all requests, or only Pending, Approved, Rejected or Cancelled ones.",
      },
      {
        target: "onboarding-list",
        title: "Review a request",
        body: "Click a request to review it. Possible rehire means the form says this person may have worked here before.",
      },
    ],
  },
  {
    id: "admin-onboarding-review",
    version: 1,
    path: /^\/admin\/onboarding\/\d+$/,
    title: "Review onboarding request",
    summary: "Check a new employee's details, then approve or reject the request.",
    tips: [
      { text: "Approving creates the employee record and sends the onboarding emails." },
      { text: "A reason for rejecting is optional, but it helps the person who sent the form." },
    ],
    steps: [
      {
        target: "onboarding-core",
        title: "Check the details",
        body: "Review these details and fix any mistakes before approving. They become the employee's record.",
      },
      {
        target: "onboarding-org-requests",
        title: "New department or location",
        body: "The form asks for a new department or location. Approve or reject it before you approve the request.",
      },
      {
        target: "onboarding-name-match",
        title: "Matching names",
        body: "Someone with this name is already in HRT. If they're returning, rehire them so their training and tickets stay attached.",
      },
      {
        target: "onboarding-actions",
        title: "Approve or reject",
        body: "Approve to add them to HRT, or Reject to turn the request down.",
      },
      {
        target: "onboarding-payload",
        title: "Submission details",
        body: "The programs, hardware, forms and notes from the form. You can't change these here.",
      },
      {
        target: "onboarding-info",
        title: "Request info",
        body: "Who sent the request, when, and when it was reviewed.",
      },
    ],
  },
];
