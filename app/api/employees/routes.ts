import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET all employees
export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: {
        lastName: "asc",
      },
    });
    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json(
      { error: "Error fetching employees" },
      { status: 500 },
    );
  }
}

// POST new employee
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const employee = await prisma.employee.create({
      data: {
        firstName: json.firstName,
        lastName: json.lastName,
        WorkAreaID: json.WorkAreaID,
        Title: json.Title,
        StartDate: json.StartDate ? new Date(json.StartDate) : null,
        FinishDate: json.FinishDate ? new Date(json.FinishDate) : null,
        IsActive: json.IsActive ?? true,
      },
    });
    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating employee" },
      { status: 500 },
    );
  }
}
