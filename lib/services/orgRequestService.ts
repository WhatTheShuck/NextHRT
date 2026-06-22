import prisma from "@/lib/prisma";
import { departmentService } from "./departmentService";
import { locationService } from "./locationService";

export type DeptRequestData = { name: string; parentDepartmentId?: number | null };
export type LocRequestData = { name: string; state: string };

class OrgRequestService {
  async createDepartmentRequest(data: DeptRequestData, userId: string) {
    return prisma.orgRequest.create({
      data: {
        type: "Department",
        requestedData: JSON.stringify(data),
        requestedByUserId: userId,
      },
    });
  }

  async createLocationRequest(data: LocRequestData, userId: string) {
    return prisma.orgRequest.create({
      data: {
        type: "Location",
        requestedData: JSON.stringify(data),
        requestedByUserId: userId,
      },
    });
  }

  async approveRequest(id: number, adminUserId: string) {
    const request = await prisma.orgRequest.findUnique({
      where: { id },
      include: {
        onboardingAsDepartment: { select: { id: true } },
        onboardingAsLocation: { select: { id: true } },
      },
    });

    if (!request) throw new Error("ORG_REQUEST_NOT_FOUND");
    if (request.status !== "Pending") throw new Error("ORG_REQUEST_NOT_PENDING");

    return prisma.$transaction(async (tx) => {
      if (request.type === "Department") {
        const data = JSON.parse(request.requestedData) as DeptRequestData;
        const dept = await departmentService.createDepartment(data, adminUserId);

        await tx.orgRequest.update({
          where: { id },
          data: {
            status: "Approved",
            reviewedByUserId: adminUserId,
            reviewedAt: new Date(),
            createdDepartmentId: dept.id,
          },
        });

        // Update any linked onboarding requests
        for (const ob of request.onboardingAsDepartment) {
          await tx.onboardingRequest.update({
            where: { id: ob.id },
            data: { departmentId: dept.id, pendingDepartmentRequestId: null },
          });
        }

        return { request: await tx.orgRequest.findUnique({ where: { id } }), created: dept };
      } else {
        const data = JSON.parse(request.requestedData) as LocRequestData;
        const loc = await locationService.createLocation(data, adminUserId);

        await tx.orgRequest.update({
          where: { id },
          data: {
            status: "Approved",
            reviewedByUserId: adminUserId,
            reviewedAt: new Date(),
            createdLocationId: loc.id,
          },
        });

        for (const ob of request.onboardingAsLocation) {
          await tx.onboardingRequest.update({
            where: { id: ob.id },
            data: { locationId: loc.id, pendingLocationRequestId: null },
          });
        }

        return { request: await tx.orgRequest.findUnique({ where: { id } }), created: loc };
      }
    });
  }

  async rejectRequest(id: number, adminUserId: string, note?: string) {
    const request = await prisma.orgRequest.findUnique({ where: { id } });
    if (!request) throw new Error("ORG_REQUEST_NOT_FOUND");
    if (request.status !== "Pending") throw new Error("ORG_REQUEST_NOT_PENDING");

    return prisma.orgRequest.update({
      where: { id },
      data: {
        status: "Rejected",
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
        note: note ?? null,
      },
    });
  }

  async getRequest(id: number) {
    return prisma.orgRequest.findUnique({
      where: { id },
      include: {
        requestedByUser: { select: { id: true, name: true, email: true } },
      },
    });
  }
}

export const orgRequestService = new OrgRequestService();
