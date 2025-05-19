import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET single employee
export const GET = auth(async function GET(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const params = await props.params;
  try {
    const id = parseInt(params.id);
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        TrainingRecords: {
          include: {
            training: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error fetching employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// PUT update employee
export const PUT = auth(async function PUT(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const params = await props.params;
  try {
    const id = parseInt(params.id);
    const json = await request.json();

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        firstName: json.firstName,
        lastName: json.lastName,
        WorkAreaID: json.WorkAreaID,
        Title: json.Title,
        Department: json.Department,
        Location: json.Location,
        StartDate: json.StartDate ? new Date(json.StartDate) : null,
        FinishDate: json.FinishDate ? new Date(json.FinishDate) : null,
        IsActive: json.IsActive,
      },
    });

    return NextResponse.json(updatedEmployee);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error updating employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});

// DELETE employee
export const DELETE = auth(async function DELETE(
  request,
  props: { params: Promise<{ id: string }> },
) {
  if (!request.auth) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const params = await props.params;
  try {
    const id = parseInt(params.id);
    await prisma.employee.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Employee deleted successfully" });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error deleting employee",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
});
