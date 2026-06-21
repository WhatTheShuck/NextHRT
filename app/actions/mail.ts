"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { mailService, MailParams } from "@/lib/services/mailService";

/**
 * Queue a notification email from a client component. Authenticated users only.
 * Delegates to mailService.send (async via the SEND_EMAIL job), so this returns
 * as soon as the job is enqueued.
 */
export async function sendNotification(params: MailParams): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    throw new Error("Not authenticated");
  }

  await mailService.send(params);
}
