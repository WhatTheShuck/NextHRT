import prisma from "@/lib/prisma";

export interface GetJobFamiliesOptions {
  activeOnly?: boolean;
}

export class JobFamilyService {
  async getJobFamilies(options: GetJobFamiliesOptions = {}) {
    const { activeOnly } = options;

    return prisma.jobFamily.findMany({
      include: {
        _count: {
          select: { employees: true },
        },
      },
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  async getJobFamilyById(id: number) {
    const jobFamily = await prisma.jobFamily.findUnique({
      where: { id },
      include: {
        _count: { select: { employees: true } },
      },
    });

    if (!jobFamily) {
      throw new Error("JOB_FAMILY_NOT_FOUND");
    }

    return jobFamily;
  }

  async createJobFamily(
    data: {
      name: string;
      isActive?: boolean;
      prefillLaptop?: boolean | null;
      prefillIpad?: boolean | null;
      prefillNonStandardLaptop?: boolean | null;
      prefillE3Licence?: boolean | null;
      prefillMarketingInduction?: boolean | null;
    },
    userId: string,
  ) {
    const existing = await prisma.jobFamily.findFirst({ where: { name: data.name } });
    if (existing) {
      throw new Error("DUPLICATE_JOB_FAMILY");
    }

    const jobFamily = await prisma.jobFamily.create({
      data: {
        name: data.name,
        isActive: data.isActive ?? true,
        prefillLaptop: data.prefillLaptop ?? null,
        prefillIpad: data.prefillIpad ?? null,
        prefillNonStandardLaptop: data.prefillNonStandardLaptop ?? null,
        prefillE3Licence: data.prefillE3Licence ?? null,
        prefillMarketingInduction: data.prefillMarketingInduction ?? null,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "JobFamily",
        recordId: jobFamily.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(jobFamily),
        userId,
      },
    });

    return jobFamily;
  }

  async updateJobFamily(
    id: number,
    data: {
      name: string;
      isActive?: boolean;
      prefillLaptop?: boolean | null;
      prefillIpad?: boolean | null;
      prefillNonStandardLaptop?: boolean | null;
      prefillE3Licence?: boolean | null;
      prefillMarketingInduction?: boolean | null;
    },
    userId: string,
  ) {
    const current = await prisma.jobFamily.findUnique({ where: { id } });
    if (!current) throw new Error("JOB_FAMILY_NOT_FOUND");

    const duplicate = await prisma.jobFamily.findFirst({
      where: { name: data.name, id: { not: id } },
    });
    if (duplicate) throw new Error("DUPLICATE_JOB_FAMILY");

    const updated = await prisma.jobFamily.update({
      where: { id },
      data: {
        name: data.name,
        isActive: data.isActive,
        prefillLaptop: data.prefillLaptop ?? null,
        prefillIpad: data.prefillIpad ?? null,
        prefillNonStandardLaptop: data.prefillNonStandardLaptop ?? null,
        prefillE3Licence: data.prefillE3Licence ?? null,
        prefillMarketingInduction: data.prefillMarketingInduction ?? null,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "JobFamily",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(current),
        newValues: JSON.stringify(updated),
        userId,
      },
    });

    return updated;
  }

  async deleteJobFamily(id: number, userId: string) {
    const current = await prisma.jobFamily.findUnique({ where: { id } });
    if (!current) throw new Error("JOB_FAMILY_NOT_FOUND");

    const employeeCount = await prisma.employee.count({ where: { jobFamilyId: id } });
    if (employeeCount > 0) throw new Error("JOB_FAMILY_HAS_EMPLOYEES");

    await prisma.$transaction([
      prisma.history.create({
        data: {
          tableName: "JobFamily",
          recordId: id.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(current),
          userId,
        },
      }),
      prisma.jobFamily.delete({ where: { id } }),
    ]);

    return { message: "Job family deleted successfully" };
  }
}

export const jobFamilyService = new JobFamilyService();
