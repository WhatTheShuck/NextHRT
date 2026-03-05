import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import {
  PrismaClient,
  Category,
  EmployeeStatus,
  ExemptionType,
  ExemptionStatus,
  UserRole,
} from "../generated/prisma_client/client";
import { faker } from "@faker-js/faker";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { deflateSync } from "zlib";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const filePath = url.replace(/^file:/, "");
const adapter = new PrismaBetterSqlite3({ url: filePath });
const prisma = new PrismaClient({ adapter });

// ─── PNG Generation ────────────────────────────────────────────────────────
// Generates a minimal solid-colour PNG file for seeded image records.

function crc32(buf: Buffer): number {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeB, data])), 0);
  return Buffer.concat([len, typeB, data, crcBuf]);
}

function createPlaceholderPng(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Buffer {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB colour type (compression, filter, interlace = 0)

  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // no-filter byte
    for (let x = 0; x < width; x++) {
      row[1 + x * 3 + 0] = r;
      row[1 + x * 3 + 1] = g;
      row[1 + x * 3 + 2] = b;
    }
    rows.push(row);
  }

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function saveImageFile(
  subDir: string,
  r: number,
  g: number,
  b: number,
): { imagePath: string; imageType: string; originalName: string } {
  const dir = path.join(process.cwd(), "uploads", subDir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const filename = `${faker.string.uuid()}.png`;
  writeFileSync(
    path.join(dir, filename),
    createPlaceholderPng(200, 150, r, g, b),
  );

  return {
    imagePath: `${subDir}/${filename}`,
    imageType: "image/png",
    originalName: `placeholder-${faker.word.noun()}.png`,
  };
}

// Different colours per training category and for tickets
const TRAINING_COLORS: Record<Category, { r: number; g: number; b: number }> =
  {
    [Category.Internal]: { r: 74, g: 144, b: 217 }, // blue
    [Category.External]: { r: 91, g: 168, b: 95 }, // green
    [Category.SOP]: { r: 224, g: 123, b: 42 }, // orange
  };
const TICKET_COLOR = { r: 123, g: 94, b: 167 }; // purple

// ─── Data Constants ──────────────────────────────────────────────────────────

const NUM_EMPLOYEES = 50;

const LOCATIONS = [
  { name: "Bundamba", state: "QLD" },
  { name: "Springfield", state: "QLD" },
  { name: "Hope Valley", state: "QLD" },
  { name: "Ipswich", state: "QLD" },
  { name: "Brisbane", state: "QLD" },
];

const PARENT_DEPTS = ["Operations", "Engineering", "Corporate Services"];

const CHILD_DEPTS = [
  { name: "Production", parent: "Operations" },
  { name: "Safety & Environment", parent: "Operations" },
  { name: "IT", parent: "Engineering" },
  { name: "Projects", parent: "Engineering" },
  { name: "Quality", parent: "Engineering" },
  { name: "Human Resources", parent: "Corporate Services" },
  { name: "Finance", parent: "Corporate Services" },
];

const INTERNAL_TRAININGS = [
  "Workplace Safety Fundamentals",
  "Emergency Response Procedures",
  "Code of Conduct and Ethics",
  "Cyber Security Awareness",
  "Manual Handling",
  "Environmental Awareness",
  "Workplace Harassment Prevention",
  "Leadership Essentials",
  "Quality Management System",
  "Incident Reporting Procedures",
];

const EXTERNAL_TRAININGS = [
  "First Aid Certificate",
  "ISO 9001 Lead Auditor",
  "Project Management Professional",
  "Six Sigma Green Belt",
  "HAZCHEM Handling",
];

const SOP_TRAININGS = [
  "SOP - Forklift Operation",
  "SOP - Chemical Handling",
  "SOP - Electrical Isolation (LOTO)",
  "SOP - Working at Heights",
  "SOP - Emergency Shutdown",
];

const TICKETS = [
  { ticketCode: "LF", ticketName: "Forklift Licence", renewal: 5 },
  { ticketCode: "EWP", ticketName: "Elevated Work Platform", renewal: 5 },
  { ticketCode: "CS", ticketName: "Confined Space Entry", renewal: 2 },
  { ticketCode: "WAH", ticketName: "Working at Heights", renewal: 2 },
  { ticketCode: "FA", ticketName: "First Aid Certificate", renewal: 3 },
  { ticketCode: "WC", ticketName: "White Card", renewal: null },
  { ticketCode: "HRW", ticketName: "High Risk Work Licence", renewal: 5 },
  { ticketCode: "ESO", ticketName: "Electrical Safety Observer", renewal: 2 },
];

// Titles keyed by department name
const DEPT_TITLES: Record<string, string[]> = {
  Production: [
    "Production Operator",
    "Senior Production Operator",
    "Maintenance Technician",
    "Team Leader",
    "Apprentice Fitter",
  ],
  "Safety & Environment": [
    "Safety Officer",
    "Senior Safety Officer",
    "Environmental Officer",
    "Safety Coordinator",
  ],
  IT: [
    "Systems Administrator",
    "Software Developer",
    "Senior Developer",
    "IT Support Analyst",
  ],
  Projects: [
    "Project Manager",
    "Senior Project Manager",
    "Project Engineer",
    "Site Coordinator",
  ],
  Quality: ["Quality Analyst", "Quality Engineer", "QA Auditor"],
  "Human Resources": [
    "HR Coordinator",
    "HR Business Partner",
    "Recruitment Specialist",
  ],
  Finance: ["Financial Analyst", "Finance Manager", "Accounts Officer"],
  Operations: ["Operations Supervisor", "Operations Manager"],
  Engineering: ["Engineer", "Senior Engineer", "Graduate Engineer"],
  "Corporate Services": ["Executive Assistant", "Administration Officer"],
};

// Approximate department headcounts (will be normalised to NUM_EMPLOYEES)
const DEPT_WEIGHTS = [
  { dept: "Production", weight: 20 },
  { dept: "Safety & Environment", weight: 6 },
  { dept: "IT", weight: 8 },
  { dept: "Projects", weight: 8 },
  { dept: "Quality", weight: 5 },
  { dept: "Human Resources", weight: 5 },
  { dept: "Finance", weight: 4 },
  { dept: "Engineering", weight: 2 },
  { dept: "Operations", weight: 2 },
];

const INTERNAL_TRAINERS = [
  "David Wilson",
  "Alice Parker",
  "Michael Chen",
  "Sarah Johnson",
  "Robert Davis",
];

const EXTERNAL_TRAINERS = [
  "St John Ambulance",
  "OSHA Certified Trainer",
  "ISO Training Institute",
  "TAFE Queensland",
  "Worksafe QLD",
];

// Which ticket codes are typical for each department
const DEPT_TICKETS: Record<string, string[]> = {
  Production: ["LF", "WC", "CS"],
  "Safety & Environment": ["FA", "EWP", "WAH"],
  Projects: ["WAH", "WC", "HRW"],
  Quality: ["WC"],
  Engineering: ["ESO", "WC"],
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Seeding database...\n");

  // ── Cleanup ──────────────────────────────────────────────────────────────
  console.log("Clearing existing data...");
  await prisma.history.deleteMany();
  await prisma.trainingImage.deleteMany();
  await prisma.ticketImage.deleteMany();
  await prisma.trainingRecords.deleteMany();
  await prisma.ticketRecords.deleteMany();
  await prisma.trainingTicketExemption.deleteMany();
  await prisma.trainingRequirement.deleteMany();
  await prisma.ticketRequirement.deleteMany();
  await prisma.appSetting.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.training.deleteMany();
  await prisma.ticket.deleteMany();
  // Delete child departments before parents (self-referential FK)
  await prisma.department.deleteMany({
    where: { parentDepartmentId: { not: null } },
  });
  await prisma.department.deleteMany();
  await prisma.location.deleteMany();

  // ── Locations ─────────────────────────────────────────────────────────────
  console.log("Creating locations...");
  const locations = await Promise.all(
    LOCATIONS.map((l) => prisma.location.create({ data: l })),
  );
  const locationByName = Object.fromEntries(locations.map((l) => [l.name, l]));

  // ── Departments ───────────────────────────────────────────────────────────
  console.log("Creating departments...");
  const parentDepts = await Promise.all(
    PARENT_DEPTS.map((name) =>
      prisma.department.create({ data: { name, level: 0 } }),
    ),
  );
  const deptByName = Object.fromEntries(parentDepts.map((d) => [d.name, d]));

  for (const { name, parent } of CHILD_DEPTS) {
    const dept = await prisma.department.create({
      data: { name, level: 1, parentDepartmentId: deptByName[parent].id },
    });
    deptByName[name] = dept;
  }

  // ── Training courses ──────────────────────────────────────────────────────
  console.log("Creating training courses...");
  const trainings = await Promise.all([
    ...INTERNAL_TRAININGS.map((title) =>
      prisma.training.create({ data: { category: Category.Internal, title } }),
    ),
    ...EXTERNAL_TRAININGS.map((title) =>
      prisma.training.create({ data: { category: Category.External, title } }),
    ),
    ...SOP_TRAININGS.map((title) =>
      prisma.training.create({ data: { category: Category.SOP, title } }),
    ),
  ]);
  const trainingByTitle = Object.fromEntries(trainings.map((t) => [t.title, t]));

  // ── Tickets ───────────────────────────────────────────────────────────────
  console.log("Creating ticket types...");
  const tickets = await Promise.all(
    TICKETS.map((t) => prisma.ticket.create({ data: t })),
  );
  const ticketByCode = Object.fromEntries(tickets.map((t) => [t.ticketCode, t]));

  // ── Training requirements ─────────────────────────────────────────────────
  console.log("Creating requirements...");

  type Req = { training: string; dept: string; location: string };
  const trainingReqs: Req[] = [
    { training: "Workplace Safety Fundamentals", dept: "Production", location: "Bundamba" },
    { training: "Workplace Safety Fundamentals", dept: "Production", location: "Ipswich" },
    { training: "SOP - Forklift Operation",       dept: "Production", location: "Bundamba" },
    { training: "SOP - Forklift Operation",       dept: "Production", location: "Ipswich" },
    { training: "SOP - Chemical Handling",         dept: "Safety & Environment", location: "Bundamba" },
    { training: "SOP - Working at Heights",        dept: "Projects",  location: "Hope Valley" },
    { training: "Code of Conduct and Ethics",      dept: "IT",        location: "Brisbane" },
    { training: "Cyber Security Awareness",        dept: "IT",        location: "Brisbane" },
    // Emergency Response Procedures required at all sites for Safety & Environment
    ...LOCATIONS.map((l) => ({
      training: "Emergency Response Procedures",
      dept: "Safety & Environment",
      location: l.name,
    })),
  ];

  for (const req of trainingReqs) {
    const training = trainingByTitle[req.training];
    const dept = deptByName[req.dept];
    const location = locationByName[req.location];
    if (training && dept && location) {
      await prisma.trainingRequirement.upsert({
        where: {
          trainingId_departmentId_locationId: {
            trainingId: training.id,
            departmentId: dept.id,
            locationId: location.id,
          },
        },
        create: {
          trainingId: training.id,
          departmentId: dept.id,
          locationId: location.id,
        },
        update: {},
      });
    }
  }

  // ── Ticket requirements ───────────────────────────────────────────────────
  type TicketReq = { ticket: string; dept: string; location: string };
  const ticketReqs: TicketReq[] = [
    { ticket: "LF",  dept: "Production",          location: "Bundamba" },
    { ticket: "LF",  dept: "Production",          location: "Ipswich" },
    { ticket: "CS",  dept: "Production",          location: "Bundamba" },
    { ticket: "WC",  dept: "Production",          location: "Springfield" },
    { ticket: "FA",  dept: "Safety & Environment", location: "Bundamba" },
    { ticket: "FA",  dept: "Safety & Environment", location: "Ipswich" },
    { ticket: "EWP", dept: "Safety & Environment", location: "Bundamba" },
    { ticket: "WAH", dept: "Projects",            location: "Hope Valley" },
  ];

  for (const req of ticketReqs) {
    const ticket = ticketByCode[req.ticket];
    const dept = deptByName[req.dept];
    const location = locationByName[req.location];
    if (ticket && dept && location) {
      await prisma.ticketRequirement.upsert({
        where: {
          ticketId_departmentId_locationId: {
            ticketId: ticket.id,
            departmentId: dept.id,
            locationId: location.id,
          },
        },
        create: {
          ticketId: ticket.id,
          departmentId: dept.id,
          locationId: location.id,
        },
        update: {},
      });
    }
  }

  // ── Employees ─────────────────────────────────────────────────────────────
  console.log(`Creating ${NUM_EMPLOYEES} employees...`);

  const totalWeight = DEPT_WEIGHTS.reduce((s, d) => s + d.weight, 0);
  const employees: Awaited<ReturnType<typeof prisma.employee.create>>[] = [];

  for (const { dept: deptName, weight } of DEPT_WEIGHTS) {
    const dept = deptByName[deptName];
    const count = Math.round((weight / totalWeight) * NUM_EMPLOYEES);
    const titleOptions = DEPT_TITLES[deptName] ?? ["Officer"];

    for (let i = 0; i < count; i++) {
      const startDate = faker.date.past({ years: 8 });
      const isActive = faker.datatype.boolean({ probability: 0.92 });

      const employee = await prisma.employee.create({
        data: {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          title: faker.helpers.arrayElement(titleOptions),
          departmentId: dept.id,
          locationId: faker.helpers.arrayElement(locations).id,
          startDate,
          finishDate: isActive
            ? null
            : faker.date.between({ from: startDate, to: new Date() }),
          isActive,
          status: faker.helpers.weightedArrayElement([
            { weight: 75, value: EmployeeStatus.Permanent },
            { weight: 10, value: EmployeeStatus.PartTimePermanent },
            { weight: 8,  value: EmployeeStatus.Apprentice },
            { weight: 4,  value: EmployeeStatus.LabourContractor },
            { weight: 3,  value: EmployeeStatus.IndustryExperience },
          ]),
          notes: faker.datatype.boolean({ probability: 0.15 })
            ? faker.lorem.sentence()
            : null,
        },
      });

      employees.push(employee);
    }
  }

  // ── Training records ──────────────────────────────────────────────────────
  console.log("Creating training records...");
  let trainingImageCount = 0;

  for (const employee of employees) {
    const numTrainings = faker.number.int({ min: 2, max: 6 });
    const used = new Set<number>();

    for (let j = 0; j < numTrainings; j++) {
      let training = faker.helpers.arrayElement(trainings);
      let attempts = 0;
      while (used.has(training.id) && attempts < 30) {
        training = faker.helpers.arrayElement(trainings);
        attempts++;
      }
      if (used.has(training.id)) break;
      used.add(training.id);

      const dateCompleted = faker.date.between({
        from: employee.startDate,
        to: employee.finishDate ?? new Date(),
      });

      const trainer =
        training.category === Category.Internal
          ? faker.helpers.arrayElement(INTERNAL_TRAINERS)
          : faker.helpers.arrayElement(EXTERNAL_TRAINERS);

      const record = await prisma.trainingRecords.create({
        data: {
          employeeId: employee.id,
          trainingId: training.id,
          dateCompleted,
          trainer,
        },
      });

      if (faker.datatype.boolean({ probability: 0.25 })) {
        const col = TRAINING_COLORS[training.category];
        const img = saveImageFile("training", col.r, col.g, col.b);
        await prisma.trainingImage.create({
          data: { trainingRecordId: record.id, ...img, uploadedAt: dateCompleted },
        });
        trainingImageCount++;
      }
    }
  }

  // ── Ticket records ────────────────────────────────────────────────────────
  console.log("Creating ticket records...");
  let ticketImageCount = 0;

  for (const employee of employees) {
    const deptName = Object.keys(deptByName).find(
      (k) => deptByName[k].id === employee.departmentId,
    );
    const assignedCodes = deptName ? (DEPT_TICKETS[deptName] ?? []) : [];
    if (assignedCodes.length === 0) continue;

    const numTickets = faker.number.int({
      min: 1,
      max: Math.min(assignedCodes.length, 3),
    });
    const selected = faker.helpers.arrayElements(assignedCodes, numTickets);

    for (const code of selected) {
      const ticket = ticketByCode[code];
      if (!ticket) continue;

      const issueDate = faker.date.between({
        from: employee.startDate,
        to: employee.finishDate ?? new Date(),
      });

      const expiryDate =
        ticket.renewal != null
          ? new Date(
              issueDate.getFullYear() + ticket.renewal,
              issueDate.getMonth(),
              issueDate.getDate(),
            )
          : null;

      const record = await prisma.ticketRecords.create({
        data: {
          employeeId: employee.id,
          ticketId: ticket.id,
          dateIssued: issueDate,
          expiryDate,
          licenseNumber: faker.datatype.boolean({ probability: 0.7 })
            ? faker.string.alphanumeric({ length: 8, casing: "upper" })
            : null,
        },
      });

      if (faker.datatype.boolean({ probability: 0.35 })) {
        const img = saveImageFile("tickets", TICKET_COLOR.r, TICKET_COLOR.g, TICKET_COLOR.b);
        await prisma.ticketImage.create({
          data: { ticketRecordId: record.id, ...img, uploadedAt: issueDate },
        });
        ticketImageCount++;
      }
    }
  }

  // ── Exemptions ────────────────────────────────────────────────────────────
  console.log("Creating exemptions...");

  const productionEmployees = employees.filter(
    (e) => e.departmentId === deptByName["Production"].id,
  );
  const safetyEmployees = employees.filter(
    (e) => e.departmentId === deptByName["Safety & Environment"].id,
  );

  if (productionEmployees.length >= 1) {
    await prisma.trainingTicketExemption.create({
      data: {
        employeeId: productionEmployees[0].id,
        type: ExemptionType.Training,
        trainingId: trainingByTitle["SOP - Forklift Operation"].id,
        reason:
          "Employee has a pre-existing medical restriction and has been permanently reassigned to non-forklift duties.",
        status: ExemptionStatus.Active,
        startDate: new Date("2024-01-15"),
      },
    });
  }

  if (productionEmployees.length >= 2) {
    await prisma.trainingTicketExemption.create({
      data: {
        employeeId: productionEmployees[1].id,
        type: ExemptionType.Ticket,
        ticketId: ticketByCode["CS"].id,
        reason:
          "Role does not require confined space access at this location. Reviewed by Safety Manager.",
        status: ExemptionStatus.Active,
        startDate: new Date("2024-06-01"),
        endDate: new Date("2026-06-01"),
      },
    });
  }

  if (safetyEmployees.length >= 1) {
    await prisma.trainingTicketExemption.create({
      data: {
        employeeId: safetyEmployees[0].id,
        type: ExemptionType.Training,
        trainingId: trainingByTitle["Emergency Response Procedures"].id,
        reason:
          "Attended equivalent emergency response training via external provider in previous role (verified).",
        status: ExemptionStatus.Expired,
        startDate: new Date("2022-03-01"),
        endDate: new Date("2024-03-01"),
      },
    });
  }

  // ── App settings ──────────────────────────────────────────────────────────
  console.log("Creating app settings...");
  await prisma.appSetting.createMany({
    data: [
      {
        key: "matching.email.enabled",
        value: "true",
        description: "Enable email-based user-employee matching",
      },
      {
        key: "matching.email.template",
        value: "{firstName}.{lastName}",
        description: "Email local-part template. Use {firstName} and {lastName} tokens.",
      },
      {
        key: "matching.nameExact.enabled",
        value: "true",
        description: "Enable exact name matching between user.name and employee full name",
      },
      {
        key: "matching.nameFuzzy.enabled",
        value: "true",
        description: "Enable fuzzy name matching using Levenshtein similarity",
      },
      {
        key: "matching.nameFuzzy.threshold",
        value: "0.7",
        description: "Minimum Levenshtein similarity (0-1) to consider a fuzzy match",
      },
      {
        key: "matching.suggestionThreshold",
        value: "50",
        description: "Minimum combined score (0-100) for a suggestion to appear",
      },
    ],
  });

  // ── Demo users ────────────────────────────────────────────────────────────
  // These users exist in the DB for demo purposes but cannot log in without
  // matching Microsoft Entra accounts. See README for first-login instructions.
  console.log("Creating demo users...");

  const itEmployees = employees.filter(
    (e) => e.departmentId === deptByName["IT"]?.id,
  );

  await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@demo.example.com",
      emailVerified: false,
      role: UserRole.Admin,
    },
  });

  if (itEmployees.length > 0) {
    await prisma.user.create({
      data: {
        name: "Sarah Johnson",
        email: "sarah.johnson@demo.example.com",
        emailVerified: false,
        role: UserRole.DepartmentManager,
        employeeId: itEmployees[0].id,
        managedDepartments: { connect: [{ id: deptByName["IT"].id }] },
      },
    });
  }

  if (productionEmployees.length >= 3) {
    await prisma.user.create({
      data: {
        name: "Marcus Williams",
        email: "marcus.williams@demo.example.com",
        emailVerified: false,
        role: UserRole.DepartmentManager,
        employeeId: productionEmployees[2].id,
        managedDepartments: { connect: [{ id: deptByName["Production"].id }] },
      },
    });
  }

  if (safetyEmployees.length >= 2) {
    await prisma.user.create({
      data: {
        name: "Emily Chen",
        email: "emily.chen@demo.example.com",
        emailVerified: false,
        role: UserRole.FireWarden,
        employeeId: safetyEmployees[1].id,
      },
    });
  }

  const lastEmployee = employees[employees.length - 1];
  await prisma.user.create({
    data: {
      name: `${lastEmployee.firstName} ${lastEmployee.lastName}`,
      email: `${lastEmployee.firstName.toLowerCase()}.${lastEmployee.lastName.toLowerCase()}@demo.example.com`,
      emailVerified: false,
      role: UserRole.User,
      employeeId: lastEmployee.id,
    },
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  const trainingRecordCount = await prisma.trainingRecords.count();
  const ticketRecordCount = await prisma.ticketRecords.count();

  console.log("\nSeed complete:");
  console.log(`  ${locations.length} locations`);
  console.log(`  ${Object.keys(deptByName).length} departments`);
  console.log(`  ${trainings.length} training courses`);
  console.log(`  ${tickets.length} ticket types`);
  console.log(`  ${employees.length} employees`);
  console.log(`  ${trainingRecordCount} training records (${trainingImageCount} with images)`);
  console.log(`  ${ticketRecordCount} ticket records (${ticketImageCount} with images)`);
  console.log(`  3 exemptions`);
  console.log(`  Up to 5 demo users`);
  console.log("\nNote: demo users cannot log in without matching Microsoft Entra accounts.");
  console.log("See README for first-login setup instructions.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
