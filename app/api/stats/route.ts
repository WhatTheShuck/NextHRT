import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export const GET = auth(async function GET(
  request,
  props: { params: Promise<{}> },
) {
  // Check if the user is authenticated
  // if (!request.auth) {
  //   return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  // }

  try {
    // Fetch statistics from the database
    const [
      totalEmployees,
      totalDepartments,
      totalLocations,
      totalTraining,
      totalTickets,
    ] = await Promise.all([
      prisma.employee.count(),
      prisma.department.count(),
      prisma.location.count(),
      prisma.training.count(),
      prisma.ticket.count(),
    ]);

    // Return the statistics as a JSON response
    return NextResponse.json({
      totalEmployees,
      totalDepartments,
      totalLocations,
      totalTraining,
      totalTickets,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { message: "Error fetching statistics" },
      { status: 500 },
    );
  }
});
