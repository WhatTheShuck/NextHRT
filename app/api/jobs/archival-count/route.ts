import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";
import { appSettingService } from "@/lib/services/appSettingService";

export async function GET(request: NextRequest) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const settings = await appSettingService.getSettings();
  const retentionYears = parseInt(
    settings["jobs.historyRetentionYears"] ?? "7",
    10,
  );

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

  const count = await prisma.history.count({
    where: { timestamp: { lt: cutoffDate } },
  });

  return NextResponse.json({ count, cutoffDate: cutoffDate.toISOString(), retentionYears });
}
