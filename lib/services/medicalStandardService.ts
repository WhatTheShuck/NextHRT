import prisma from "@/lib/prisma";

export interface GetMedicalStandardsOptions {
  activeOnly?: boolean;
}

export class MedicalStandardService {
  async getMedicalStandards(options: GetMedicalStandardsOptions) {
    const { activeOnly } = options;

    const medicalStandards = await prisma.medicalStandard.findMany({
      include: {
        _count: {
          select: {
            onboardingRequests: true,
          },
        },
      },
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });

    return medicalStandards;
  }

  async getMedicalStandardById(id: number) {
    const medicalStandard = await prisma.medicalStandard.findUnique({
      where: { id },
      include: {
        _count: {
          select: { onboardingRequests: true },
        },
      },
    });

    if (!medicalStandard) {
      throw new Error("MEDICAL_STANDARD_NOT_FOUND");
    }

    return medicalStandard;
  }

  async createMedicalStandard(
    data: {
      name: string;
      isActive?: boolean;
      managerEmailSubject?: string;
      managerEmailBody?: string;
      employeeEmailSubject?: string;
      employeeEmailBody?: string;
    },
    userId: string,
  ) {
    const existing = await prisma.medicalStandard.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new Error("DUPLICATE_MEDICAL_STANDARD");
    }

    const medicalStandard = await prisma.medicalStandard.create({
      data: {
        name: data.name,
        isActive: data.isActive ?? true,
        managerEmailSubject: data.managerEmailSubject ?? "",
        managerEmailBody: data.managerEmailBody ?? "",
        employeeEmailSubject: data.employeeEmailSubject ?? "",
        employeeEmailBody: data.employeeEmailBody ?? "",
      },
    });

    await prisma.history.create({
      data: {
        tableName: "MedicalStandard",
        recordId: medicalStandard.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(medicalStandard),
        userId,
      },
    });

    return medicalStandard;
  }

  async updateMedicalStandard(
    id: number,
    data: {
      name?: string;
      isActive?: boolean;
      managerEmailSubject?: string;
      managerEmailBody?: string;
      employeeEmailSubject?: string;
      employeeEmailBody?: string;
    },
    userId: string,
  ) {
    const current = await prisma.medicalStandard.findUnique({
      where: { id },
    });

    if (!current) {
      throw new Error("MEDICAL_STANDARD_NOT_FOUND");
    }

    if (data.name && data.name !== current.name) {
      const existing = await prisma.medicalStandard.findUnique({
        where: { name: data.name },
      });
      if (existing) {
        throw new Error("DUPLICATE_MEDICAL_STANDARD");
      }
    }

    const updated = await prisma.medicalStandard.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.managerEmailSubject !== undefined ? { managerEmailSubject: data.managerEmailSubject } : {}),
        ...(data.managerEmailBody !== undefined ? { managerEmailBody: data.managerEmailBody } : {}),
        ...(data.employeeEmailSubject !== undefined ? { employeeEmailSubject: data.employeeEmailSubject } : {}),
        ...(data.employeeEmailBody !== undefined ? { employeeEmailBody: data.employeeEmailBody } : {}),
      },
    });

    await prisma.history.create({
      data: {
        tableName: "MedicalStandard",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(current),
        newValues: JSON.stringify(updated),
        userId,
      },
    });

    return updated;
  }

  async deleteMedicalStandard(id: number, userId: string) {
    const current = await prisma.medicalStandard.findUnique({
      where: { id },
      include: {
        _count: {
          select: { onboardingRequests: true },
        },
      },
    });

    if (!current) {
      throw new Error("MEDICAL_STANDARD_NOT_FOUND");
    }

    if (current._count.onboardingRequests > 0) {
      throw new Error("MEDICAL_STANDARD_IN_USE");
    }

    await prisma.$transaction([
      prisma.history.create({
        data: {
          tableName: "MedicalStandard",
          recordId: id.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(current),
          userId,
        },
      }),
      prisma.medicalStandard.delete({
        where: { id },
      }),
    ]);

    return { message: "Medical standard deleted successfully" };
  }

  async ensureDefaults() {
    const defaults = ["KSB Standard", "No", "Telfer"];
    for (const name of defaults) {
      await prisma.medicalStandard.upsert({
        where: { name },
        create: { name },
        update: {},
      });
    }
  }
}

export const medicalStandardService = new MedicalStandardService();
