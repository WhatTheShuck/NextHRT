import { PrismaClient, Category } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // First, clear existing data
  await prisma.trainingRecords.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.training.deleteMany({});

  // Create training courses
  const internalSafety = await prisma.training.create({
    data: {
      category: Category.Internal,
      title: "Workplace Safety Fundamentals",
      RenewalPeriod: 12, // 12 months
    },
  });

  const firstAid = await prisma.training.create({
    data: {
      category: Category.External,
      title: "First Aid Certification",
      RenewalPeriod: 24, // 24 months
    },
  });

  const cyberSecurity = await prisma.training.create({
    data: {
      category: Category.Internal,
      title: "Cyber Security Awareness",
      RenewalPeriod: 12,
    },
  });

  // Create employees
  const john = await prisma.employee.create({
    data: {
      firstName: "John",
      lastName: "Smith",
      WorkAreaID: 1,
      Title: "Senior Engineer",
      StartDate: new Date("2023-01-15"),
      IsActive: true,
    },
  });

  const sarah = await prisma.employee.create({
    data: {
      firstName: "Sarah",
      lastName: "Johnson",
      WorkAreaID: 2,
      Title: "Project Manager",
      StartDate: new Date("2022-06-01"),
      IsActive: true,
    },
  });

  const michael = await prisma.employee.create({
    data: {
      firstName: "Michael",
      lastName: "Brown",
      WorkAreaID: 1,
      Title: "Technical Lead",
      StartDate: new Date("2021-03-10"),
      IsActive: true,
    },
  });

  const emma = await prisma.employee.create({
    data: {
      firstName: "Emma",
      lastName: "Davis",
      WorkAreaID: 3,
      Title: "Software Developer",
      StartDate: new Date("2023-09-01"),
      IsActive: true,
    },
  });

  // Create training records
  const trainingRecords = await Promise.all([
    // John's training records
    prisma.trainingRecords.create({
      data: {
        employeeId: john.id,
        trainingId: internalSafety.id,
        dateCompleted: new Date("2023-02-15"),
        expiryDate: new Date("2024-02-15"),
        trainer: "David Wilson",
      },
    }),
    prisma.trainingRecords.create({
      data: {
        employeeId: john.id,
        trainingId: cyberSecurity.id,
        dateCompleted: new Date("2023-03-01"),
        expiryDate: new Date("2024-03-01"),
        trainer: "Alice Parker",
      },
    }),

    // Sarah's training records
    prisma.trainingRecords.create({
      data: {
        employeeId: sarah.id,
        trainingId: firstAid.id,
        dateCompleted: new Date("2022-07-01"),
        expiryDate: new Date("2024-07-01"),
        trainer: "Red Cross Instructor",
      },
    }),

    // Michael's training records
    prisma.trainingRecords.create({
      data: {
        employeeId: michael.id,
        trainingId: internalSafety.id,
        dateCompleted: new Date("2023-01-10"),
        expiryDate: new Date("2024-01-10"),
        trainer: "David Wilson",
      },
    }),
    prisma.trainingRecords.create({
      data: {
        employeeId: michael.id,
        trainingId: firstAid.id,
        dateCompleted: new Date("2023-04-15"),
        expiryDate: new Date("2025-04-15"),
        trainer: "Red Cross Instructor",
      },
    }),

    // Emma's training records
    prisma.trainingRecords.create({
      data: {
        employeeId: emma.id,
        trainingId: cyberSecurity.id,
        dateCompleted: new Date("2023-09-15"),
        expiryDate: new Date("2024-09-15"),
        trainer: "Alice Parker",
      },
    }),
  ]);

  console.log("Database has been seeded with test data!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
