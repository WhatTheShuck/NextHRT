import prisma from "@/lib/prisma";

export interface GetProgramsOptions {
  activeOnly?: boolean;
}

export interface ProgramWriteData {
  name: string;
  ticketNumber?: string | null;
  infoRequired?: string | null;
  requiresReferenceUser?: boolean;
  isActive?: boolean;
}

interface ProgramDefault {
  name: string;
  ticketNumber: string;
  infoRequired: string;
  requiresReferenceUser: boolean;
}

// Placeholder seed values (spec §5.3 / §6.4). Real ticket numbers + "info
// required" text to be filled in by an Admin later.
const PROGRAM_DEFAULTS: ProgramDefault[] = [
  {
    name: "SAP",
    ticketNumber: "PLACEHOLDER-SAP",
    infoRequired: "Placeholder — info required for SAP access.",
    requiresReferenceUser: true,
  },
  {
    name: "C4C Sales",
    ticketNumber: "PLACEHOLDER-C4C-SALES",
    infoRequired: "Placeholder — info required for C4C Sales access.",
    requiresReferenceUser: false,
  },
  {
    name: "C4C Service",
    ticketNumber: "PLACEHOLDER-C4C-SERVICE",
    infoRequired: "Placeholder — info required for C4C Service access.",
    requiresReferenceUser: true,
  },
  {
    name: "Easy Select",
    ticketNumber: "PLACEHOLDER-EASY-SELECT",
    infoRequired: "Placeholder — info required for Easy Select access.",
    requiresReferenceUser: false,
  },
  {
    name: "KSBase",
    ticketNumber: "PLACEHOLDER-KSBASE",
    infoRequired: "Placeholder — info required for KSBase access.",
    requiresReferenceUser: false,
  },
  {
    name: "Webshop / E2E",
    ticketNumber: "PLACEHOLDER-WEBSHOP-E2E",
    infoRequired: "Placeholder — info required for Webshop / E2E access.",
    requiresReferenceUser: false,
  },
  {
    name: "Full Microsoft E3 licence",
    ticketNumber: "PLACEHOLDER-E3-LICENCE",
    infoRequired: "Placeholder — info required for Full Microsoft E3 licence.",
    requiresReferenceUser: false,
  },
];

export class ProgramService {
  /**
   * Idempotently seed placeholder programs. Upserts on the unique `name`, so it
   * is safe to run repeatedly and won't collide with concurrent agents. Never
   * overwrites admin-edited values on update (mirrors appSettingService).
   */
  async ensureDefaults(): Promise<void> {
    const upserts = PROGRAM_DEFAULTS.map((p) =>
      prisma.program.upsert({
        where: { name: p.name },
        create: {
          name: p.name,
          ticketNumber: p.ticketNumber,
          infoRequired: p.infoRequired,
          requiresReferenceUser: p.requiresReferenceUser,
        },
        update: {}, // never overwrite admin-set values
      }),
    );
    await Promise.all(upserts);
  }

  async getPrograms(options: GetProgramsOptions = {}) {
    await this.ensureDefaults();
    const { activeOnly } = options;

    return prisma.program.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ name: "asc" }],
    });
  }

  async getProgramById(id: number) {
    const program = await prisma.program.findUnique({ where: { id } });

    if (!program) {
      throw new Error("PROGRAM_NOT_FOUND");
    }

    return program;
  }

  async createProgram(data: ProgramWriteData, userId: string) {
    const existing = await prisma.program.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new Error("DUPLICATE_PROGRAM");
    }

    const program = await prisma.program.create({
      data: {
        name: data.name,
        ticketNumber: data.ticketNumber ?? null,
        infoRequired: data.infoRequired ?? null,
        requiresReferenceUser: data.requiresReferenceUser ?? false,
        isActive: data.isActive ?? true,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "Program",
        recordId: program.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(program),
        userId,
      },
    });

    return program;
  }

  async updateProgram(id: number, data: ProgramWriteData, userId: string) {
    const currentProgram = await prisma.program.findUnique({ where: { id } });

    if (!currentProgram) {
      throw new Error("PROGRAM_NOT_FOUND");
    }

    if (data.name && data.name !== currentProgram.name) {
      const duplicate = await prisma.program.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        throw new Error("DUPLICATE_PROGRAM");
      }
    }

    const updatedProgram = await prisma.program.update({
      where: { id },
      data: {
        name: data.name,
        ticketNumber: data.ticketNumber ?? null,
        infoRequired: data.infoRequired ?? null,
        requiresReferenceUser: data.requiresReferenceUser,
        isActive: data.isActive,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "Program",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(currentProgram),
        newValues: JSON.stringify(updatedProgram),
        userId,
      },
    });

    return updatedProgram;
  }

  async deleteProgram(id: number, userId: string) {
    const currentProgram = await prisma.program.findUnique({ where: { id } });

    if (!currentProgram) {
      throw new Error("PROGRAM_NOT_FOUND");
    }

    await prisma.$transaction([
      prisma.history.create({
        data: {
          tableName: "Program",
          recordId: id.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(currentProgram),
          userId,
        },
      }),
      prisma.program.delete({ where: { id } }),
    ]);

    return { message: "Program deleted successfully" };
  }
}

export const programService = new ProgramService();
