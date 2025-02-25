import { PrismaClient, Category } from "@prisma/client";
import { faker } from "@faker-js/faker";

const prisma = new PrismaClient();

// Configuration
const NUM_EMPLOYEES = 1000;
const NUM_TRAININGS = 15;
const LOCATIONS = [
  "Bundamba",
  "Springfield",
  "Hope Valley",
  "Ipswich",
  "Brisbane",
];
const DEPARTMENTS = [
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
const WORK_AREAS = [1, 2, 3, 4, 5]; // WorkAreaIDs
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

  // First, clear existing data
  await prisma.trainingRecords.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.training.deleteMany({});

  console.log("Creating training courses...");

  // Create training courses
  const trainings = [];

  // Create internal trainings
  for (let i = 0; i < INTERNAL_TRAININGS.length; i++) {
    const training = await prisma.training.create({
      data: {
        category: Category.Internal,
        title: INTERNAL_TRAININGS[i],
        RenewalPeriod: faker.helpers.arrayElement([6, 12, 24, 36]), // 6, 12, 24 or 36 months
      },
    });
    trainings.push(training);
  }

  // Create external trainings
  for (let i = 0; i < EXTERNAL_TRAININGS.length; i++) {
    const training = await prisma.training.create({
      data: {
        category: Category.External,
        title: EXTERNAL_TRAININGS[i],
        RenewalPeriod: faker.helpers.arrayElement([12, 24, 36, 48]), // External trainings usually have longer periods
      },
    });
    trainings.push(training);
  }

  console.log(`Created ${trainings.length} training courses`);

  console.log("Creating employees and their training records...");

  // Create employees with their training records
  const employees = [];

  for (let i = 0; i < NUM_EMPLOYEES; i++) {
    // Generate employee data
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const department = faker.helpers.arrayElement(DEPARTMENTS);
    const location = faker.helpers.arrayElement(LOCATIONS);
    const workAreaId = faker.helpers.arrayElement(WORK_AREAS);
    const title = faker.helpers.arrayElement(TITLES);

    // Set realistic start date (between 5 years ago and now)
    const startDate = faker.date.past({ years: 5 });

    // Determine if employee is active (90% chance)
    const isActive = faker.helpers.weightedArrayElement([
      { weight: 9, value: true },
      { weight: 1, value: false },
    ]);

    // Set finish date only for inactive employees
    const finishDate = isActive
      ? null
      : faker.date.between({
          from: startDate,
          to: new Date(),
        });

    // Create the employee
    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        WorkAreaID: workAreaId,
        Title: title,
        Department: department,
        Location: location,
        StartDate: startDate,
        FinishDate: finishDate,
        IsActive: isActive,
      },
    });

    employees.push(employee);

    // Generate 1-5 training records for each employee
    const numTrainings = faker.number.int({ min: 1, max: 5 });
    const assignedTrainings = new Set();

    for (let j = 0; j < numTrainings; j++) {
      // Select a random training
      let training;
      do {
        training = faker.helpers.arrayElement(trainings);
      } while (assignedTrainings.has(training.id));

      assignedTrainings.add(training.id);

      // Set completion date between start date and now (or finish date for inactive employees)
      const completionDate = faker.date.between({
        from: startDate,
        to: finishDate || new Date(),
      });

      // Calculate expiry date based on training renewal period
      const expiryDate = new Date(completionDate);
      expiryDate.setMonth(expiryDate.getMonth() + training.RenewalPeriod);

      // Select appropriate trainer based on training category
      const trainer =
        training.category === Category.Internal
          ? faker.helpers.arrayElement(INTERNAL_TRAINERS)
          : faker.helpers.arrayElement(EXTERNAL_TRAINERS);

      // Create training record
      await prisma.trainingRecords.create({
        data: {
          employeeId: employee.id,
          trainingId: training.id,
          dateCompleted: completionDate,
          expiryDate: expiryDate,
          trainer: trainer,
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
