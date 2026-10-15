import { who } from "../audience";
import type { PageTour } from "../types";

export const generalTours: PageTour[] = [
  {
    id: "dashboard",
    version: 1,
    path: /^\/$/,
    title: "Your dashboard",
    summary: "Your starting point. Each card opens a part of HRT, and you only see the ones that apply to you.",
    tips: [
      { text: "Click the HRT logo at the top left to come back here from anywhere." },
      { text: "Use the search box at the top to jump straight to a page or a person." },
      { text: "A red number on a card means something is waiting for you.", when: who.managerOrAdmin },
      {
        text: "Most of HRT stays hidden until an administrator connects your sign-in to your employee record.",
        when: (a) => !a.linked && !a.admin,
      },
    ],
    steps: [
      {
        title: "Welcome to HRT",
        body: "This is where you'll find your training, tickets, SOPs and forms. Here's a quick look around. It takes about a minute.",
      },
      {
        target: "account-pending",
        title: "Your account is almost ready",
        body: "An administrator needs to connect your sign-in to your employee record. Until then, most of HRT is hidden. You don't need to do anything.",
        when: who.unlinked,
      },
      {
        target: "account-check-again",
        title: "Check again",
        body: "Once you've been told your account is ready, click here to see everything.",
        when: who.unlinked,
      },
      {
        target: "welcome-card",
        title: "Start here",
        body: "These shortcuts take you to the things most people need first.",
      },
      {
        target: "dashboard-my-actions",
        title: "Your actions",
        body: "Each card opens a part of HRT. Click a card to go there.",
      },
      {
        target: "card:/employees",
        title: "Your records",
        body: "Your training, tickets and SOPs in one place. Check that your details are right.",
        when: who.nonAdmin,
      },
      {
        target: "card:/employees",
        title: "Employees",
        body: "Everyone's records: training, tickets, SOPs, exemptions and history.",
        when: who.admin,
      },
      {
        target: "card:/my-sops",
        title: "My SOPs",
        body: "Read the procedures for your job and answer their questions so they can be signed off.",
      },
      {
        target: "card:/expiring",
        title: "Expiring & Missing",
        body: "Tickets that are about to expire or have expired, and any tickets or training you still need. You can upload a new copy from here.",
        isNew: true,
      },
      {
        target: "card:/quiz",
        title: "My Questionnaires",
        body: "Questionnaires you've been asked to fill in. You can stop part-way and pick up where you left off.",
      },
      {
        target: "card:/forms",
        title: "Forms",
        body: "Request training here. You can also see how your requests are going.",
      },
      {
        target: "card:/access-check",
        title: "Who can see my data",
        body: "See exactly who can view your records.",
        when: who.nonAdmin,
      },
      {
        target: "card:/approvals",
        title: "Approvals",
        body: "Training requests waiting for your decision. The red number shows how many.",
        when: who.managerOrAdmin,
      },
      {
        target: "card:/reports",
        title: "Reports",
        body: "Training, ticket and employee reports for the people you look after.",
        when: who.reports,
      },
      {
        target: "team-access",
        title: "Your team on HRT",
        body: "Shows who in your team hasn't signed in yet. Copy the reminder and send it to them.",
        when: who.manager,
        isNew: true,
      },
      {
        target: "dashboard-admin-tools",
        title: "Administrative tools",
        body: "Some tools have been grouped: Users & Access, System and Email each open a page with more tools.",
        when: who.admin,
        isNew: true,
      },
      {
        target: "card:/expiring?tab=review",
        title: "Document Reviews",
        body: "Tickets and certificates people have uploaded. Check each one, then add it to their records or send it back.",
        when: who.admin,
        isNew: true,
      },
      {
        target: "card:/admin/access",
        title: "Users & Access",
        body: "Link sign-ins to employees, and manage the org chart and API keys. The red number counts people waiting to be linked.",
        when: who.admin,
        isNew: true,
      },
      {
        selector: 'header button[aria-label="Search"]',
        title: "Search",
        body: "Type here to jump to any page or find a person. You can also press Ctrl+K from anywhere.",
        isNew: true,
      },
      {
        target: "profile-menu",
        title: "Your profile",
        body: "Change how HRT looks, choose when page tips appear, or sign out.",
      },
      {
        target: "help-button",
        title: "Help is always here",
        body: "Click this any time for tips about the page you're on, or to be walked through it again.",
        side: "top",
        isNew: true,
      },
    ],
  },
  {
    id: "profile",
    version: 1,
    path: /^\/profile$/,
    title: "Profile and settings",
    summary: "Your account details, and settings for how HRT looks and behaves for you.",
    tips: [
      { text: "Turn page tips back on here if you'd like to be walked through pages again." },
    ],
    steps: [
      {
        target: "profile-details",
        title: "Your account",
        body: "Your role in HRT and the employee record your sign-in is connected to. If something looks wrong, contact IT.",
      },
      {
        target: "profile-appearance",
        title: "Appearance",
        body: "Pick a colour theme for HRT. It only changes what you see.",
      },
      {
        target: "profile-tutorials",
        title: "Page tips",
        body: "Choose whether pages walk you through themselves the first time, every time, or only when you ask. You can also show them all again.",
        isNew: true,
      },
    ],
  },
];
