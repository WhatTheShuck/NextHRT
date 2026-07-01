import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { medicalStandardService } from "@/lib/services/medicalStandardService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const medicalStandardId = parseInt(id);
    const medicalStandard =
      await medicalStandardService.getMedicalStandardById(medicalStandardId);
    return NextResponse.json(medicalStandard);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "MEDICAL_STANDARD_NOT_FOUND":
          return NextResponse.json(
            { error: "Medical standard not found" },
            { status: 404 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error fetching medical standard",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const medicalStandardId = parseInt(id);
    const json = await request.json();
    const updated = await medicalStandardService.updateMedicalStandard(
      medicalStandardId,
      json,
      session.user.id,
    );
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "MEDICAL_STANDARD_NOT_FOUND":
          return NextResponse.json(
            { error: "Medical standard not found" },
            { status: 404 },
          );
        case "DUPLICATE_MEDICAL_STANDARD":
          return NextResponse.json(
            { error: "A medical standard with this name already exists" },
            { status: 409 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error updating medical standard",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getAuth(request);

  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  if (session.user.role !== "Admin") {
    return NextResponse.json({ message: "Not authorised" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const medicalStandardId = parseInt(id);
    const result = await medicalStandardService.deleteMedicalStandard(
      medicalStandardId,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) {
      switch (error.message) {
        case "MEDICAL_STANDARD_NOT_FOUND":
          return NextResponse.json(
            { error: "Medical standard not found" },
            { status: 404 },
          );
        case "MEDICAL_STANDARD_IN_USE":
          return NextResponse.json(
            {
              error:
                "Cannot delete medical standard that is referenced by onboarding requests",
            },
            { status: 400 },
          );
      }
    }
    return NextResponse.json(
      {
        error: "Error deleting medical standard",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
