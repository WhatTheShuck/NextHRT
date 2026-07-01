import "server-only";
import path from "path";
import prisma from "@/lib/prisma";
import { enqueue } from "@/lib/jobs/jobQueue";
import { mailService, type MailAttachment } from "@/lib/services/mailService";
import { emailTemplateService } from "@/lib/services/emailTemplateService";
import { appSettingService } from "@/lib/services/appSettingService";
import { onboardingService } from "@/lib/services/onboardingService";
import { parseStoredAttachments } from "@/lib/services/onboardingConfigService";
import { companyDetails } from "@/lib/data";
import { FILE_UPLOAD_CONFIG, estimateEncodedSize } from "@/lib/file-config";
import type { OnboardingProgramSelection } from "@/lib/services/onboardingService";

// Infer the types from the approveRequest return so they stay in sync automatically.
type ApprovalResult = Awaited<ReturnType<typeof onboardingService.approveRequest>>;
type FanOutRequest = ApprovalResult["request"];
type FanOutEmployee = ApprovalResult["employee"];

interface ManagerInfo {
  name: string;
  email: string | null;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function displayName(
  preferred: string | null | undefined,
  legal: string,
  preferredLast: string | null | undefined,
  legalLast: string,
) {
  return `${preferred ?? legal} ${preferredLast ?? legalLast}`;
}

// Returns an ICS calendar attachment for an all-day "free" event on startDate.
// TRANSP:TRANSPARENT means it shows as "not busy" in the recipient's calendar.
function buildCalendarInvite(
  requestId: number,
  startDate: Date,
  employeeName: string,
): MailAttachment {
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr =
    `${startDate.getFullYear()}${pad(startDate.getMonth() + 1)}${pad(startDate.getDate())}`;
  const nextDay = new Date(startDate);
  nextDay.setDate(nextDay.getDate() + 1);
  const nextDateStr =
    `${nextDay.getFullYear()}${pad(nextDay.getMonth() + 1)}${pad(nextDay.getDate())}`;
  const now = new Date();
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KSB//HRT//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:onboarding-${requestId}@ksb.com`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateStr}`,
    `DTEND;VALUE=DATE:${nextDateStr}`,
    `SUMMARY:First day: ${employeeName}`,
    `DESCRIPTION:New hire start date for ${employeeName}.`,
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return { filename: "invite.ics", content: ics, contentType: "text/calendar" };
}

class OnboardingFanOutService {
  // Build interpolation vars for email templates.
  private buildVars(
    request: FanOutRequest,
    employee: FanOutEmployee,
    managerInfo: ManagerInfo | null,
    employeeEmail: string,
  ): Record<string, string | null | undefined> {
    const iamValidTo = new Date(request.startDate);
    iamValidTo.setFullYear(iamValidTo.getFullYear() + 1);
    return {
      legalFirstName: request.legalFirstName,
      legalLastName: request.legalLastName,
      preferredFirstName: request.preferredFirstName ?? request.legalFirstName,
      preferredLastName: request.preferredLastName ?? request.legalLastName,
      title: request.title,
      department: employee.department.name,
      location: employee.location.name,
      startDate: formatDate(request.startDate),
      iamValidTo: formatDate(iamValidTo),
      managerName: managerInfo?.name ?? "",
      employmentType: request.employmentType,
      email: employeeEmail,
    };
  }

  // Look up the manager employee to get their display name and linked User email.
  private async lookupManager(managerEmployeeId: number): Promise<ManagerInfo | null> {
    const emp = await prisma.employee.findUnique({
      where: { id: managerEmployeeId },
      select: {
        legalFirstName: true,
        legalLastName: true,
        preferredFirstName: true,
        preferredLastName: true,
        User: { select: { email: true } },
      },
    });
    if (!emp) return null;
    return {
      name: displayName(
        emp.preferredFirstName,
        emp.legalFirstName,
        emp.preferredLastName,
        emp.legalLastName,
      ),
      email: emp.User?.email ?? null,
    };
  }

  // Fetch program details + reference-user names; return a pre-rendered HTML list.
  private async buildProgramsList(
    selections: OnboardingProgramSelection[],
    itTicketBaseUrl: string,
  ): Promise<string> {
    if (selections.length === 0) return "";

    const programIds = selections.map((s) => s.programId);
    const programs = await prisma.program.findMany({ where: { id: { in: programIds } } });

    const refUserIds = selections
      .map((s) => s.referenceUserEmployeeId)
      .filter((id): id is number => id != null);

    const refUsers =
      refUserIds.length > 0
        ? await prisma.employee.findMany({
            where: { id: { in: refUserIds } },
            select: {
              id: true,
              legalFirstName: true,
              legalLastName: true,
              preferredFirstName: true,
              preferredLastName: true,
            },
          })
        : [];

    const programMap = new Map(programs.map((p) => [p.id, p]));
    const refUserMap = new Map(refUsers.map((u) => [u.id, u]));

    const lines: string[] = [];
    for (const sel of selections) {
      const program = programMap.get(sel.programId);
      if (!program) continue;

      const ticketUrl = program.ticketNumber
        ? `${itTicketBaseUrl}${program.ticketNumber}`
        : null;

      const refEmp = sel.referenceUserEmployeeId
        ? refUserMap.get(sel.referenceUserEmployeeId)
        : null;
      const refUserName = refEmp
        ? displayName(
            refEmp.preferredFirstName,
            refEmp.legalFirstName,
            refEmp.preferredLastName,
            refEmp.legalLastName,
          )
        : null;

      let line = `<li><strong>${program.name}</strong>`;
      if (ticketUrl) line += `<br>Ticket: <a href="${ticketUrl}">${ticketUrl}</a>`;
      if (program.infoRequired) line += `<br>Info required: ${program.infoRequired}`;
      if (refUserName) line += `<br>Reference user: ${refUserName}`;
      line += "</li>";
      lines.push(line);
    }

    return `<ul>\n${lines.join("\n")}\n</ul>`;
  }

  // §7.1 — Manager "next steps" email; branches on Internal/External.
  private async enqueueManagerEmail(
    request: FanOutRequest,
    vars: Record<string, string | null | undefined>,
    managerInfo: ManagerInfo | null,
  ): Promise<void> {
    if (!managerInfo?.email) return;

    const templateKey =
      request.employmentType === "Internal"
        ? "manager.nextSteps.internal"
        : "manager.nextSteps.external";

    const { subject, body } = await emailTemplateService.render(templateKey, vars);
    const employeeName = `${vars.preferredFirstName ?? ""} ${vars.preferredLastName ?? ""}`.trim();
    const invite = buildCalendarInvite(request.id, request.startDate, employeeName);
    await mailService.send({ to: managerInfo.email, subject, html: body, attachments: [invite] });
  }

  // §7.3 — Forms-related jobs (offer reminder, attachments, marketing, medical, licence).
  private async enqueueFormsJobs(
    request: FanOutRequest,
    vars: Record<string, string | null | undefined>,
    payload: ReturnType<typeof onboardingService.parsePayload>,
    settings: Record<string, string>,
    managerInfo: ManagerInfo | null,
    employeeEmail: string,
  ): Promise<void> {
    const compliance = payload.compliance;
    const managerEmail = managerInfo?.email;

    // Letter of offer NOT signed → scheduled reminder at commencement date.
    if (!compliance.letterOfOfferSigned && managerEmail) {
      const { subject, body } = await emailTemplateService.render(
        "forms.offerReminder",
        vars,
      );
      await enqueue(
        "SEND_EMAIL",
        { to: managerEmail, subject, html: body } as Record<string, unknown>,
        request.startDate,
      );
    }

    // Employment forms / police check → email manager with any stored attachments.
    if ((compliance.employmentFormsRequired || compliance.policeCheckRequired) && managerEmail) {
      const attachments: { filename: string; path: string }[] = [];
      let rawBytes = 0;
      const collect = (settingKey: string) => {
        for (const a of parseStoredAttachments(settings[settingKey])) {
          attachments.push({
            filename: a.name,
            path: path.join(process.cwd(), "uploads", a.path),
          });
          rawBytes += a.size;
        }
      };
      if (compliance.employmentFormsRequired) {
        collect("onboarding.attachment.employmentForms");
      }
      if (compliance.policeCheckRequired) {
        collect("onboarding.attachment.policeCheck");
      }

      // Defensive guard: uploads are size-checked, but legacy/zero-size entries
      // could slip through. If the encoded payload would exceed the mail-server
      // limit, drop the attachments rather than fail the send, and tell the
      // manager the forms will follow separately.
      const oversized =
        estimateEncodedSize(rawBytes) > FILE_UPLOAD_CONFIG.MAX_EMAIL_SIZE;
      if (oversized) {
        console.error(
          `[onboarding-fan-out] Compliance attachments for request ${request.id} ` +
            `exceed the ${FILE_UPLOAD_CONFIG.MAX_EMAIL_SIZE_DISPLAY} email limit; sending without them.`,
        );
      }

      const { subject, body } = await emailTemplateService.render("forms.attachments", vars);
      const html = oversized
        ? body +
          `<p><strong>Note:</strong> the employment / police-check forms were too large to attach to this email and will be sent to you separately.</p>`
        : body;
      await mailService.send({
        to: managerEmail,
        subject,
        html,
        ...(!oversized && attachments.length > 0 ? { attachments } : {}),
      });
    }

    // Marketing induction → email Marketing recipient.
    if (compliance.marketingInductionRequired) {
      const marketingRecipient = settings["onboarding.recipient.marketing"];
      if (marketingRecipient) {
        const { subject, body } = await emailTemplateService.render(
          "marketing.induction",
          vars,
        );
        await mailService.send({ to: marketingRecipient, subject, html: body });
      }
    }

    // Medical required → manager email at startDate + employee follow-up 3 days later.
    // "No" medical standard = none required; skip.
    const medicalRequired =
      request.medicalStandardId != null && request.medicalStandard?.name !== "No";

    if (medicalRequired && request.medicalStandard) {
      const ms = request.medicalStandard;

      if (managerEmail && ms.managerEmailBody) {
        const subject = emailTemplateService.interpolate(ms.managerEmailSubject, vars);
        const body = emailTemplateService.interpolate(ms.managerEmailBody, vars);
        await enqueue(
          "SEND_EMAIL",
          { to: managerEmail, subject, html: body } as Record<string, unknown>,
          request.startDate,
        );
      }

      // Employee follow-up: 3 days after start date so their mailbox exists.
      if (ms.employeeEmailBody) {
        const followUpDate = new Date(request.startDate);
        followUpDate.setDate(followUpDate.getDate() + 3);
        const empSubject = emailTemplateService.interpolate(ms.employeeEmailSubject, vars);
        const empBody = emailTemplateService.interpolate(ms.employeeEmailBody, vars);
        await enqueue(
          "SEND_EMAIL",
          { to: employeeEmail, subject: empSubject, html: empBody } as Record<string, unknown>,
          followUpDate,
        );
      }
    }

    // Vehicle → email licence recipient; they request a copy from the employee.
    if (compliance.willReceiveVehicle || compliance.willDriveVehicle) {
      const licenceRecipient = settings["onboarding.recipient.licence"];
      if (licenceRecipient) {
        const { subject, body } = await emailTemplateService.render("licence.request", vars);
        await mailService.send({ to: licenceRecipient, subject, html: body });
      }
    }

    // Vehicle → notify manager.
    if ((compliance.willReceiveVehicle || compliance.willDriveVehicle) && managerEmail) {
      const { subject, body } = await emailTemplateService.render("manager.vehicle", {
        ...vars,
        willReceiveVehicle: compliance.willReceiveVehicle ? "Yes" : "No",
        willDriveVehicle: compliance.willDriveVehicle ? "Yes" : "No",
      });
      await mailService.send({ to: managerEmail, subject, html: body });
    }
  }

  // §7.4 — Consolidated IT email covering all selected programs.
  private async enqueueProgramsEmail(
    request: FanOutRequest,
    vars: Record<string, string | null | undefined>,
    payload: ReturnType<typeof onboardingService.parsePayload>,
    settings: Record<string, string>,
  ): Promise<void> {
    if (payload.programs.length === 0) return;

    const itRecipient = settings["onboarding.recipient.it"];
    if (!itRecipient) return;

    const itTicketBaseUrl =
      settings["onboarding.itTicketBaseUrl"] ||
      "https://itsp.intern.ksb.com/assystnet/#serviceOfferings/";

    const programsList = await this.buildProgramsList(payload.programs, itTicketBaseUrl);

    const { subject, body } = await emailTemplateService.render("it.programs", {
      ...vars,
      programs: programsList,
      notes: payload.notes.it ?? "",
    });

    const employeeName = `${vars.preferredFirstName ?? ""} ${vars.preferredLastName ?? ""}`.trim();
    const invite = buildCalendarInvite(request.id, request.startDate, employeeName);
    await mailService.send({ to: itRecipient, subject, html: body, attachments: [invite] });
  }

  // §7.4 (notes portion) + §5.5 — HR and Payroll notes emails.
  private async enqueueHrPayrollNotes(
    vars: Record<string, string | null | undefined>,
    payload: ReturnType<typeof onboardingService.parsePayload>,
    settings: Record<string, string>,
  ): Promise<void> {
    const hrNote = payload.notes.hr;
    const hrRecipient = settings["onboarding.recipient.hr"];
    if (hrNote && hrRecipient) {
      const { subject, body } = await emailTemplateService.render("hr.notes", {
        ...vars,
        notes: hrNote,
      });
      await mailService.send({ to: hrRecipient, subject, html: body });
    }

    const payrollNote = payload.notes.payroll;
    const payrollRecipient = settings["onboarding.recipient.payroll"];
    if (payrollNote && payrollRecipient) {
      const { subject, body } = await emailTemplateService.render("payroll.notes", {
        ...vars,
        notes: payrollNote,
      });
      await mailService.send({ to: payrollRecipient, subject, html: body });
    }
  }

  // §7.5 — One HARDWARE_REQUEST job per selected hardware item.
  private async enqueueHardwareJobs(
    request: FanOutRequest,
    employee: FanOutEmployee,
    payload: ReturnType<typeof onboardingService.parsePayload>,
  ): Promise<void> {
    for (const selection of payload.hardware) {
      await enqueue("HARDWARE_REQUEST", {
        hardwareItemId: selection.hardwareItemId,
        employeeId: employee.id,
        managerEmployeeId: request.managerEmployeeId,
        nonStandard: selection.nonStandard ?? false,
        justification: selection.justification ?? null,
      });
    }
  }

  /**
   * Entry point called from the approve route after the transaction commits.
   * Enqueues all downstream jobs (§7). Each section runs independently so one
   * failure doesn't prevent the others from enqueueing.
   */
  async enqueueAll(request: FanOutRequest, employee: FanOutEmployee): Promise<void> {
    const payload = onboardingService.parsePayload(request);

    const [settings, managerInfo] = await Promise.all([
      appSettingService.getSettings(),
      request.managerEmployeeId
        ? this.lookupManager(request.managerEmployeeId)
        : Promise.resolve(null),
    ]);

    const domain = companyDetails.domain_extension;
    const preferredFirst = request.preferredFirstName ?? request.legalFirstName;
    const preferredLast = request.preferredLastName ?? request.legalLastName;
    const employeeEmail = `${preferredFirst.toLowerCase()}.${preferredLast.toLowerCase()}@${domain}`;

    const vars = this.buildVars(request, employee, managerInfo, employeeEmail);

    const results = await Promise.allSettled([
      this.enqueueManagerEmail(request, vars, managerInfo),
      this.enqueueFormsJobs(request, vars, payload, settings, managerInfo, employeeEmail),
      this.enqueueProgramsEmail(request, vars, payload, settings),
      this.enqueueHrPayrollNotes(vars, payload, settings),
      this.enqueueHardwareJobs(request, employee, payload),
    ]);

    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        console.error(
          `[onboarding-fan-out] Section ${i} failed for request ${request.id}:`,
          result.reason,
        );
      }
    }
  }
}

export const onboardingFanOutService = new OnboardingFanOutService();
