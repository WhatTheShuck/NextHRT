import prisma from "@/lib/prisma";

export interface GetLocationsOptions {
  activeOnly?: boolean;
}

export interface GetLocationByIdOptions {
  activeOnly?: boolean;
}

export class LocationService {
  async getLocations(options: GetLocationsOptions) {
    const { activeOnly } = options;

    const locations = await prisma.location.findMany({
      include: {
        _count: {
          select: {
            employees: true,
          },
        },
        employees: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
          },
        },
      },
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ state: "asc" }, { name: "asc" }],
    });

    return locations.map((location) => ({
      ...location,
      _count: {
        employees: location._count.employees,
        activeEmployees: location.employees.length,
      },
      employees: undefined,
    }));
  }

  async getLocationById(id: number, options: GetLocationByIdOptions) {
    const { activeOnly } = options;

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        employees: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            title: true,
            department: {
              select: {
                name: true,
              },
            },
          },
          where: activeOnly ? { isActive: true } : undefined,
        },
        _count: {
          select: { employees: true },
        },
      },
    });

    if (!location) {
      throw new Error("LOCATION_NOT_FOUND");
    }

    return location;
  }

  async createLocation(
    data: { name: string; state: string },
    userId: string,
  ) {
    const location = await prisma.location.create({
      data: {
        name: data.name,
        state: data.state,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "Location",
        recordId: location.id.toString(),
        action: "CREATE",
        newValues: JSON.stringify(location),
        userId,
      },
    });

    return location;
  }

  async updateLocation(
    id: number,
    data: { name: string; state: string },
    userId: string,
  ) {
    const currentLocation = await prisma.location.findUnique({
      where: { id },
    });

    if (!currentLocation) {
      throw new Error("LOCATION_NOT_FOUND");
    }

    const updatedLocation = await prisma.location.update({
      where: { id },
      data: {
        name: data.name,
        state: data.state,
      },
    });

    await prisma.history.create({
      data: {
        tableName: "Location",
        recordId: id.toString(),
        action: "UPDATE",
        oldValues: JSON.stringify(currentLocation),
        newValues: JSON.stringify(updatedLocation),
        userId,
      },
    });

    return updatedLocation;
  }

  async deleteLocation(id: number, userId: string) {
    const employeeCount = await prisma.employee.count({
      where: { locationId: id },
    });

    if (employeeCount > 0) {
      throw new Error("LOCATION_HAS_EMPLOYEES");
    }

    const currentLocation = await prisma.location.findUnique({
      where: { id },
    });

    if (!currentLocation) {
      throw new Error("LOCATION_NOT_FOUND");
    }

    await prisma.$transaction([
      prisma.history.create({
        data: {
          tableName: "Location",
          recordId: id.toString(),
          action: "DELETE",
          oldValues: JSON.stringify(currentLocation),
          userId,
        },
      }),
      prisma.location.delete({
        where: { id },
      }),
    ]);

    return { message: "Location deleted successfully" };
  }
}

export const locationService = new LocationService();
