import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  employee: [
    "viewSelf",
    "viewDepartment",
    "viewAll",
    "viewEvacReport",
    "edit",
    "create",
    "delete",
  ],
  department: ["create", "view", "edit", "manage", "viewAll"],
  reports: ["viewEmployee", "evac", "viewTicket", "view", "viewTraining"],
} as const;

export const ac = createAccessControl(statement);

export const adminRole = ac.newRole({
  ...adminAc.statements,
  employee: [
    "viewSelf",
    "viewDepartment",
    "viewAll",
    "viewEvacReport",
    "edit",
    "create",
    "delete",
  ],
  department: ["view", "edit", "manage", "viewAll"],
  reports: ["view", "viewTicket", "viewTraining", "viewEmployee", "evac"],
});

export const departmentManagerRole = ac.newRole({
  employee: ["viewSelf", "viewDepartment", "edit"],
  department: ["view", "manage"],
  reports: ["viewEmployee", "viewTicket", "viewTraining"],
});

export const fireWardenRole = ac.newRole({
  employee: ["viewSelf", "viewEvacReport"], // Fire wardens need to view all staff, but subset of data
  department: ["view"],
  reports: ["view", "evac"],
});

export const userRole = ac.newRole({
  employee: ["viewSelf"], // Can only view their own employee record
  department: ["view"],
});
