import { who } from "../audience";
import type { Audience, PageTour } from "../types";

/** Sees only their own records: no team, not an admin. */
const ownOnly = (a: Audience) => !a.manager && !a.admin;

export const documentTours: PageTour[] = [
  {
    id: "expiring",
    version: 1,
    path: /^\/expiring$/,
    title: "Expiring & Missing",
    summary: "Tickets and training that are about to expire, have expired or are still needed. Upload a new copy from here and follow it until it's checked.",
    tips: [
      { text: "Click Upload on any row and the form opens with the details already chosen." },
      { text: "You'll get an email when your upload is approved or sent back." },
      { text: "The Document Reviews card on the dashboard opens the review queue.", when: who.admin },
    ],
    steps: [
      {
        target: "account-pending",
        title: "Not linked yet",
        body: "Your sign-in isn't connected to your employee record yet. Until it is, ask your manager to upload documents for you.",
        when: who.unlinked,
      },
      {
        target: "expiring-intro",
        title: "Expiring & Missing",
        body: "Your tickets and training that are running out, have run out or are still needed.",
        when: ownOnly,
        isNew: true,
      },
      {
        target: "expiring-intro",
        title: "Expiring & Missing",
        body: "Tickets and training that are running out, have run out or are still needed, for you and the people you look after.",
        when: who.managerOrAdmin,
        isNew: true,
      },
      {
        target: "expiring-upload",
        title: "Upload a document",
        body: "Send a photo or scan of a ticket, licence or external training certificate, even if it isn't listed below.",
        isNew: true,
      },
      {
        target: "expiring-filters",
        title: "Find someone",
        body: "Search by name or pick a department to narrow every list.",
      },
      {
        target: "expiring-tabs",
        title: "The lists",
        body: "Switch between lists here. The number on each one shows how many are in it.",
      },
      {
        target: "expiring-review-tab",
        title: "Review queue",
        body: "Uploads waiting for an admin to check them. The Document Reviews card on the dashboard brings you straight here.",
        when: who.admin,
        isNew: true,
      },
      {
        target: "expiring-tab-expiring",
        title: "Expiring",
        body: "Tickets that will run out soon, soonest first. Upload the new card once you've renewed it.",
      },
      {
        target: "expiring-tab-expired",
        title: "Expired",
        body: "Tickets that have already run out. Upload the new card once you've renewed it.",
      },
      {
        target: "expiring-tab-missing",
        title: "Missing",
        body: "Tickets and external training needed for the job that aren't on record yet, or that need to be done again.",
      },
      {
        target: "expiring-tab-submitted",
        title: "Submitted",
        body: "Uploads waiting to be checked or sent back for a change, plus ones accepted in the last 30 days.",
      },
      {
        target: "expiring-tab-review",
        title: "Waiting for review",
        body: "Every upload that hasn't been checked yet, oldest first.",
        when: who.admin,
      },
      {
        target: "expiring-row-upload",
        title: "Upload from here",
        body: "Click Upload to send a photo of the card or certificate. The form opens with the person and item already chosen.",
      },
      {
        target: "expiring-chip",
        title: "Already uploaded",
        body: "Awaiting review means it hasn't been checked yet. Sent back means it needs a change; if you uploaded it, tap the badge to fix it.",
      },
      {
        target: "expiring-status",
        title: "Status",
        body: "Awaiting review means it hasn't been checked yet, and Approved means it's on the record. Sent back means it needs a change, with the reason shown in quotes.",
      },
      {
        target: "expiring-fix",
        title: "Fix it",
        body: "Opens your upload with the reason it was sent back, so you can change it and send it again.",
      },
      {
        target: "expiring-cancel",
        title: "Cancel",
        body: "Withdraws your upload straight away, with no undo. You can always upload it again.",
      },
      {
        target: "expiring-review-open",
        title: "Review",
        body: "Open an upload to check the files, then approve it or send it back.",
        when: who.admin,
      },
    ],
  },
  {
    id: "document-upload",
    version: 1,
    path: /^\/forms\/document-upload$/,
    title: "Upload a document",
    summary: "Send a photo or scan of a ticket, licence or external training certificate. An admin checks it, then adds it to the record or sends it back with a reason.",
    tips: [
      { text: "Add the front and back if the card has both. You can attach up to 6 files." },
      { text: "Make sure the name and dates on the photo are easy to read." },
      { text: "Uploading the same item again replaces an earlier upload of it that's still waiting." },
    ],
    steps: [
      {
        target: "account-pending",
        title: "Not linked yet",
        body: "Your sign-in isn't connected to your employee record yet. Until it is, give the document to your manager to upload for you.",
        when: who.unlinked,
      },
      {
        target: "docs-intro",
        title: "Upload a document",
        body: "Send a photo or scan of a ticket, licence or external training certificate. An admin checks it before it's added to the record.",
        isNew: true,
      },
      {
        target: "docs-sent-back",
        title: "Why it came back",
        body: "The admin's reason for sending it back. Fix what they asked, then resubmit it at the bottom.",
        isNew: true,
      },
      {
        target: "docs-read-only",
        title: "View only",
        body: "This upload can't be changed. It's being checked, already finished, or waiting for the person who sent it.",
      },
      {
        target: "docs-employee",
        title: "Who it's for",
        body: "Choose the person the document belongs to. You'll only see people you're allowed to upload for.",
      },
      {
        target: "docs-kind",
        title: "What kind",
        body: "Pick Ticket or licence, or External training.",
      },
      {
        target: "docs-item",
        title: "Which one",
        body: "Search the list for the ticket or training. If you came from Expiring & Missing, it's already chosen.",
      },
      {
        target: "docs-dates",
        title: "Dates",
        body: "When it was issued or completed. For a ticket, the expiry date is worked out for you; change it if the card says otherwise.",
      },
      {
        target: "docs-licence",
        title: "Card number",
        body: "The number on the ticket or licence, if it has one. You can leave this blank.",
      },
      {
        target: "docs-provider",
        title: "Who delivered it?",
        body: "The company or trainer that ran the course. Training can't be sent without it.",
      },
      {
        target: "docs-file-buttons",
        title: "Add photos",
        body: "Take photo opens your camera. Choose from gallery picks a saved photo, and Upload PDF or image picks a file.",
        isNew: true,
      },
      {
        target: "docs-file-thumbs",
        title: "Check your photos",
        body: "Make sure each one is clear and easy to read. Tap the X to remove one.",
      },
      {
        target: "docs-files-readonly",
        title: "The files",
        body: "What was uploaded. Click one to open it full size.",
      },
      {
        target: "docs-submit",
        title: "Send it off",
        body: "Click Send for review (or Resubmit for review). You'll get an email once an admin has approved it or sent it back.",
      },
    ],
  },
  {
    id: "document-review",
    version: 1,
    path: /^\/expiring\/review\/\d+$/,
    title: "Review a document",
    summary: "Check an uploaded ticket or certificate. Approve it to add it to the employee's record, or send it back with a reason.",
    when: who.admin,
    tips: [
      { text: "Approving creates the ticket or training record, with the files attached." },
      { text: "The person who uploaded it gets an email either way." },
      { text: "Fix small mistakes yourself before approving, rather than sending it back." },
    ],
    steps: [
      {
        target: "docs-review-files",
        title: "The files",
        body: "What was uploaded. Click a photo to open it full size, where you can zoom in.",
        isNew: true,
      },
      {
        target: "docs-review-rotate",
        title: "Rotate",
        body: "Turns a sideways photo so it's easier to read. The saved file isn't changed.",
      },
      {
        target: "docs-review-who",
        title: "Who and when",
        body: "Who it's for, who uploaded it and when.",
      },
      {
        target: "docs-review-item",
        title: "Check the details",
        body: "Make sure the ticket or training, dates and number match the files. You can correct them here before approving.",
      },
      {
        target: "docs-review-dates",
        title: "Dates",
        body: "For a ticket, changing the ticket or issue date works out the expiry again. You can still change it yourself.",
      },
      {
        target: "docs-review-approve",
        title: "Approve",
        body: "Adds it to the employee's record with the details shown, and emails the person who uploaded it.",
      },
      {
        target: "docs-review-send-back",
        title: "Send it back",
        body: "Say what needs fixing, then click Send back with this reason. A reason is required, and the uploader sees it.",
      },
      {
        target: "docs-review-done",
        title: "Already decided",
        body: "This upload has already been approved, sent back or cancelled, so there's nothing left to do.",
      },
    ],
  },
];
