import { who } from "../audience";
import type { Audience, PageTour } from "../types";

/**
 * Leaf report pages that get the generic tour: anything one level under a
 * report group, except the pages below that have a tour of their own.
 */
const GENERIC_REPORT =
  /^\/reports\/(?!(?:training|tickets)\/needs-analysis$|tickets\/expiring$|employee\/list$)(?:employee|training|tickets|access)\/[^/]+$/;

/** Managers see their own team; admins see everyone, so they get different wording. */
const managerNotAdmin = (a: Audience) => a.manager && !a.admin;

export const reportsTours: PageTour[] = [
  {
    id: "reports",
    version: 1,
    path: /^\/reports$/,
    title: "Reports",
    summary:
      "Lists of training, tickets and staff that you can sort, print or save. You only see the reports that apply to you.",
    tips: [
      { text: "Every report can be saved as an Excel spreadsheet or a PDF." },
      { text: "Reports only show the people you look after.", when: managerNotAdmin },
      { text: "Click a group heading to see just the reports in that group." },
    ],
    steps: [
      {
        title: "Your reports",
        body: "Here you can build lists of training, tickets and staff, then print or save them.",
      },
      {
        target: "report-category",
        title: "Report groups",
        body: "Reports are grouped by topic. Click a heading to see just that group.",
      },
      {
        target: "card:/reports/employee/list",
        title: "Current Employee List",
        body: "Everyone working here right now, with their location. Handy for an evacuation roll call.",
      },
      {
        target: "card:/reports/training/needs-analysis",
        title: "Who still needs training",
        body: "Pick a training course and see who still has to complete it.",
      },
      {
        target: "card:/reports/tickets/expiring",
        title: "Tickets running out",
        body: "See whose tickets expire soon, so renewals can be booked in time.",
      },
      {
        target: "card:/reports/access/all",
        title: "Who can see what",
        body: "Check which users can see each employee's records.",
        when: who.admin,
      },
    ],
  },
  {
    id: "reports-group",
    version: 1,
    path: /^\/reports\/(employee|training|tickets|access)$/,
    title: "Report group",
    summary: "All the reports in one group. Pick a card to open that report.",
    tips: [
      { text: "Reports only show the people you look after.", when: managerNotAdmin },
      { text: "Reports whose names start with \"All\" cover everyone at once, so they can be long and take a moment to load." },
    ],
    steps: [
      {
        target: "report-cards",
        title: "Choose a report",
        body: "Each card is one report, with a short note on what it shows. Click a card to open it.",
      },
      // Employee reports
      {
        target: "card:/reports/employee/needs-analysis",
        title: "One person's needs",
        body: "Pick an employee and see the training and tickets they still need.",
      },
      {
        target: "card:/reports/employee/training-and-tickets",
        title: "One person's records",
        body: "An employee's training and tickets together in one list.",
      },
      // Training reports
      {
        target: "card:/reports/training/needs-analysis",
        title: "One course",
        body: "Pick a training course and see who still needs to complete it.",
      },
      {
        target: "card:/reports/training/required-training",
        title: "Everything outstanding",
        body: "All required training that hasn't been done yet, for everyone at once.",
      },
      // Ticket reports
      {
        target: "card:/reports/tickets/expiring",
        title: "Tickets running out",
        body: "Pick a ticket and see whose will expire in the coming months.",
      },
      {
        target: "card:/reports/tickets/required-tickets",
        title: "Everything outstanding",
        body: "All required tickets that people don't have yet, for everyone at once.",
      },
      // Access reports
      {
        target: "card:/reports/access/all",
        title: "Everyone's access",
        body: "Each employee, with the users who can see their records.",
      },
    ],
  },
  {
    id: "report",
    version: 1,
    path: GENERIC_REPORT,
    title: "Running a report",
    summary:
      "Choose what to report on, and the list appears below. You can sort it, then save it as an Excel spreadsheet or a PDF.",
    tips: [
      { text: "Click a column heading to sort the list. Click it again to reverse the order." },
      { text: "If you've sorted the list, saving asks whether to keep your order or use the original one." },
      { text: "You'll only see people you look after.", when: who.nonAdmin },
    ],
    steps: [
      {
        target: "report-dates",
        title: "Pick the dates",
        body: "Choose a start and end date. Everyone who started work between them is listed.",
      },
      {
        target: "report-options",
        title: "Narrow it down",
        body: "Use these switches to add extra records, such as inactive employees, expired tickets or courses that are no longer used.",
      },
      {
        target: "report-picker",
        title: "Pick what to report on",
        body: "Search for what you want to report on and click it. Your results appear below.",
      },
      {
        target: "report-export",
        title: "Export",
        body: "Save the results as an Excel spreadsheet or a PDF to print or share.",
      },
      {
        target: "report-location-filter",
        title: "Filter by location",
        body: "Show only people at one location. Pick All Locations to see everyone again.",
      },
      {
        target: "data-table",
        title: "Your results",
        body: "Click a column heading to sort the list. You'll only see people you look after.",
        when: who.nonAdmin,
      },
      {
        target: "data-table",
        title: "Your results",
        body: "Click a column heading to sort the list. As an administrator, you can see everyone.",
        when: who.admin,
      },
    ],
  },
  {
    id: "report-needs",
    version: 1,
    path: /^\/reports\/(training|tickets)\/needs-analysis$/,
    title: "Who still needs it",
    summary:
      "Pick a training course or ticket and see everyone who is required to have it but doesn't yet.",
    tips: [
      { text: "Turn on Include completed records to see everyone it applies to, not just those still to do it." },
      { text: "Exempted means that person has been excused from it." },
      { text: "You'll only see people you look after.", when: who.nonAdmin },
    ],
    steps: [
      {
        target: "report-options",
        title: "Include completed",
        body: "Leave this off to see only who still needs it. Switch it on to also see people who have done it or are excused.",
      },
      {
        target: "report-picker",
        title: "Pick what to check",
        body: "Search for the training course or ticket and click it. The list appears below.",
      },
      {
        target: "report-export",
        title: "Export",
        body: "Save the list as an Excel spreadsheet or a PDF, for example to plan a training session.",
      },
      {
        target: "data-table",
        title: "Who needs it",
        body: "The Status column shows Required, Completed or Exempted. You'll only see people you look after.",
        when: who.nonAdmin,
      },
      {
        target: "data-table",
        title: "Who needs it",
        body: "The Status column shows Required, Completed or Exempted. As an administrator, you can see everyone.",
        when: who.admin,
      },
    ],
  },
  {
    id: "report-expiring",
    version: 1,
    path: /^\/reports\/tickets\/expiring$/,
    title: "Upcoming Ticket Expiration",
    summary:
      "Pick a ticket and see whose will run out soon, so you can book renewals before they lapse.",
    tips: [
      { text: "Choose how far ahead to look, from 30 days up to 360 days." },
      { text: "Turn on Include recently expired to catch tickets that have already run out." },
      { text: "You'll only see people you look after.", when: who.nonAdmin },
    ],
    steps: [
      {
        target: "report-options",
        title: "Extra records",
        body: "Switch these on to include inactive employees, or tickets that are no longer used.",
      },
      {
        target: "report-recently-expired",
        title: "Recently expired",
        body: "Also list tickets that have already run out. Once it's on, choose how far back to look.",
      },
      {
        target: "report-picker",
        title: "Pick a ticket",
        body: "Search for the ticket you want to check and click it. The list appears below.",
      },
      {
        target: "report-expiry-window",
        title: "How far ahead",
        body: "Choose how many days ahead to look, from 30 up to 360.",
      },
      {
        target: "report-export",
        title: "Export",
        body: "Save the list as an Excel spreadsheet or a PDF to share or follow up.",
      },
      {
        target: "report-location-filter",
        title: "Filter by location",
        body: "Show only people at one location. Pick All Locations to see everyone again.",
      },
      {
        target: "data-table",
        title: "Who to follow up",
        body: "Everyone whose ticket runs out in that time. You'll only see people you look after.",
        when: who.nonAdmin,
      },
      {
        target: "data-table",
        title: "Who to follow up",
        body: "Everyone whose ticket runs out in that time. As an administrator, you can see everyone.",
        when: who.admin,
      },
    ],
  },
  {
    id: "report-employee-list",
    version: 1,
    path: /^\/reports\/employee\/list$/,
    title: "Current Employee List",
    summary:
      "Everyone working here right now, across all departments. Use it as a roll call during an evacuation.",
    tips: [
      { text: "Export to PDF to print a paper copy for the assembly point." },
      { text: "Filter by location to list only the people on your site." },
    ],
    steps: [
      {
        target: "report-export",
        title: "Print or save",
        body: "Save the list as a PDF to print, or as an Excel spreadsheet.",
      },
      {
        target: "report-location-filter",
        title: "Your site",
        body: "Show only the people at one location. Pick All Locations to see everyone again.",
      },
      {
        target: "data-table",
        title: "Who's here",
        body: "Every current employee, with their department and location. Click a column heading to sort.",
      },
    ],
  },
];
