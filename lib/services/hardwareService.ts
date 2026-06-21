import prisma from "@/lib/prisma";

export interface GetHardwareItemsOptions {
  activeOnly?: boolean;
}

interface HardwareItemInput {
  name: string;
  payloadTemplate?: string | null;
  isActive?: boolean;
}

interface HardwareDefault {
  name: string;
  payloadTemplate: string;
}

// Seed placeholders (spec §5.4). The payloadTemplate is a JSON stub for the
// hardware-request platform; real per-item payloads are TBD (§9.1.2).
const HARDWARE_DEFAULTS: HardwareDefault[] = [
  { name: "Laptop", payloadTemplate: '{"type":"<TODO>","item":"Laptop"}' },
  {
    name: "Non-standard laptop",
    payloadTemplate: '{"type":"<TODO>","item":"Non-standard laptop"}',
  },
  { name: "iPad", payloadTemplate: '{"type":"<TODO>","item":"iPad"}' },
  { name: "Phone", payloadTemplate: '{"type":"<TODO>","item":"Phone"}' },
  {
    name: "Non-standard phone",
    payloadTemplate: '{"type":"<TODO>","item":"Non-standard phone"}',
  },
];

export class HardwareService {
  async ensureDefaults(): Promise<void> {
    const upserts = HARDWARE_DEFAULTS.map((h) =>
      prisma.hardwareItem.upsert({
        where: { name: h.name },
        create: { name: h.name, payloadTemplate: h.payloadTemplate },
        update: {}, // never overwrite an admin-edited item
      }),
    );
    await Promise.all(upserts);
  }

  async getHardwareItems(options: GetHardwareItemsOptions = {}) {
    await this.ensureDefaults();
    const { activeOnly } = options;

    return prisma.hardwareItem.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { name: "asc" },
    });
  }

  async getHardwareItemById(id: number) {
    const item = await prisma.hardwareItem.findUnique({ where: { id } });

    if (!item) {
      throw new Error("HARDWARE_ITEM_NOT_FOUND");
    }

    return item;
  }

  async createHardwareItem(data: HardwareItemInput, userId: string) {
    const existing = await prisma.hardwareItem.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw new Error("DUPLICATE_HARDWARE_ITEM");
    }

    const item = await prisma.hardwareItem.create({
      data: {
        name: data.name,
        payloadTemplate: data.payloadTemplate ?? null,
        isActive: data.isActive ?? true,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "HardwareItem",
        recordId: item.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(item),
        userId,
      },
    });

    return item;
  }

  async updateHardwareItem(
    id: number,
    data: HardwareItemInput,
    userId: string,
  ) {
    const current = await prisma.hardwareItem.findUnique({ where: { id } });

    if (!current) {
      throw new Error("HARDWARE_ITEM_NOT_FOUND");
    }

    if (data.name && data.name !== current.name) {
      const duplicate = await prisma.hardwareItem.findUnique({
        where: { name: data.name },
      });
      if (duplicate) {
        throw new Error("DUPLICATE_HARDWARE_ITEM");
      }
    }

    const updated = await prisma.hardwareItem.update({
      where: { id },
      data: {
        name: data.name,
        payloadTemplate: data.payloadTemplate ?? null,
        isActive: data.isActive ?? current.isActive,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "HardwareItem",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(current),
        newValues: JSON.stringify(updated),
        userId,
      },
    });

    return updated;
  }

  async deleteHardwareItem(id: number, userId: string) {
    const current = await prisma.hardwareItem.findUnique({ where: { id } });

    if (!current) {
      throw new Error("HARDWARE_ITEM_NOT_FOUND");
    }

    await prisma.$transaction([
      prisma.history.create({
        data: {
          tableName: "HardwareItem",
          recordId: id.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(current),
          userId,
        },
      }),
      prisma.hardwareItem.delete({ where: { id } }),
    ]);

    return { message: "Hardware item deleted successfully" };
  }
}

export const hardwareService = new HardwareService();
