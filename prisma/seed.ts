import { PrismaClient, Category } from "../generated/prisma_client";
import { faker } from "@faker-js/faker";
const prisma = new PrismaClient();

// Configuration
const NUM_EMPLOYEES = 1000;

const LOCATION_NAMES = [
  "Bundamba",
  "Springfield",
  "Hope Valley",
  "Ipswich",
  "Brisbane",
];
const LOCATION_STATE = "QLD";

const DEPARTMENT_NAMES = [
  "Engineering",
  "IT",
  "Projects",
  "Operations",
  "HR",
  "Finance",
  "Quality",
  "Safety",
  "Production",
];

const TITLES = [
  "Engineer",
  "Senior Engineer",
  "Lead Engineer",
  "Project Manager",
  "Technical Lead",
  "Software Developer",
  "Senior Developer",
  "QA Engineer",
  "Safety Officer",
  "Operations Supervisor",
  "HR Specialist",
  "Financial Analyst",
  "Production Worker",
  "Team Lead",
  "Department Manager",
  "Executive Assistant",
  "Business Analyst",
  "Technical Specialist",
  "Director",
  "Junior Developer",
];

// Training category options
const INTERNAL_TRAININGS = [
  "Workplace Safety Fundamentals",
  "Cyber Security Awareness",
  "Code of Conduct",
  "Emergency Response Procedures",
  "Leadership Skills",
  "Project Management Basics",
  "Quality Management System",
  "Environmental Awareness",
  "Workplace Harassment Prevention",
  "Data Privacy and GDPR",
];

const EXTERNAL_TRAININGS = [
  "First Aid Certification",
  "OSHA Safety Training",
  "ISO 9001 Internal Auditor",
  "Certified Scrum Master",
  "AWS Cloud Practitioner",
  "Microsoft Office Specialist",
  "Six Sigma Green Belt",
  "PMP Certification",
  "Forklift Operation License",
  "Hazardous Materials Handling",
];

// Trainer names
const INTERNAL_TRAINERS = [
  "David Wilson",
  "Alice Parker",
  "Michael Chen",
  "Sarah Johnson",
  "Robert Davis",
];

const EXTERNAL_TRAINERS = [
  "Red Cross Instructor",
  "OSHA Certified Trainer",
  "ISO Training Institute",
  "Scrum Alliance Coach",
  "AWS Certified Instructor",
];

async function main() {
  console.log("Starting database seed...");

  // Clear existing data in dependency order
  await prisma.trainingRecords.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.training.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.location.deleteMany({});

  // Create locations
  console.log("Creating locations...");
  const locations = await Promise.all(
    LOCATION_NAMES.map((name) =>
      prisma.location.create({ data: { name, state: LOCATION_STATE } }),
    ),
  );

  // Create departments
  console.log("Creating departments...");
  const departments = await Promise.all(
    DEPARTMENT_NAMES.map((name) =>
      prisma.department.create({ data: { name } }),
    ),
  );

  console.log("Creating training courses...");

  // Create training courses
  const trainings = [];

  for (const title of INTERNAL_TRAININGS) {
    const training = await prisma.training.create({
      data: { category: Category.Internal, title },
    });
    trainings.push(training);
  }

  for (const title of EXTERNAL_TRAININGS) {
    const training = await prisma.training.create({
      data: { category: Category.External, title },
    });
    trainings.push(training);
  }

  console.log(`Created ${trainings.length} training courses`);
  console.log("Creating employees and their training records...");

  const employees = [];

  for (let i = 0; i < NUM_EMPLOYEES; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const department = faker.helpers.arrayElement(departments);
    const location = faker.helpers.arrayElement(locations);
    const title = faker.helpers.arrayElement(TITLES);

    const startDate = faker.date.past({ years: 5 });

    const isActive = faker.helpers.weightedArrayElement([
      { weight: 9, value: true },
      { weight: 1, value: false },
    ]);

    const finishDate = isActive
      ? null
      : faker.date.between({ from: startDate, to: new Date() });

    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        title,
        departmentId: department.id,
        locationId: location.id,
        startDate,
        finishDate,
        isActive,
      },
    });

    employees.push(employee);

    // Generate 1-5 training records for each employee
    const numTrainings = faker.number.int({ min: 1, max: 5 });
    const assignedTrainings = new Set<number>();

    for (let j = 0; j < numTrainings; j++) {
      let training;
      do {
        training = faker.helpers.arrayElement(trainings);
      } while (assignedTrainings.has(training.id));

      assignedTrainings.add(training.id);

      const completionDate = faker.date.between({
        from: startDate,
        to: finishDate || new Date(),
      });

      const trainer =
        training.category === Category.Internal
          ? faker.helpers.arrayElement(INTERNAL_TRAINERS)
          : faker.helpers.arrayElement(EXTERNAL_TRAINERS);

      await prisma.trainingRecords.create({
        data: {
          employeeId: employee.id,
          trainingId: training.id,
          dateCompleted: completionDate,
          trainer,
        },
      });
    }
  }

  console.log(
    `Created ${employees.length} employees with their training records`,
  );
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
