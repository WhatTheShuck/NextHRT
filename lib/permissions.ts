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
  department: ["create", "view", "edit", "delete", "manage", "viewAll"],
  location: ["create", "edit", "delete", "view"],
  training: ["create", "edit", "delete", "view"],
  ticket: ["create", "edit", "delete", "view"],
  trainingRecord: ["create", "edit", "delete", "view"],
  ticketRecord: ["create", "edit", "delete", "view"],
  exemption: ["create", "edit", "delete", "view"],
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
  department: ["create", "view", "edit", "delete", "manage", "viewAll"],
  location: ["create", "edit", "delete", "view"],
  training: ["create", "edit", "delete", "view"],
  ticket: ["create", "edit", "delete", "view"],
  trainingRecord: ["create", "edit", "delete", "view"],
  ticketRecord: ["create", "edit", "delete", "view"],
  exemption: ["create", "edit", "delete", "view"],
  reports: ["view", "viewTicket", "viewTraining", "viewEmployee", "evac"],
});

export const departmentManagerRole = ac.newRole({
  employee: ["viewSelf", "viewDepartment"],
  department: ["view", "manage"],
  location: ["view"],
  training: ["view"],
  ticket: ["view"],
  trainingRecord: ["view"],
  ticketRecord: ["view"],
  exemption: ["view"],
  reports: ["viewEmployee", "viewTicket", "viewTraining"],
});

export const fireWardenRole = ac.newRole({
  employee: ["viewSelf", "viewEvacReport"], // Fire wardens need to view all staff, but subset of data
  department: ["view"],
  location: ["view"],
  reports: ["view", "evac"],
});

export const userRole = ac.newRole({
  employee: ["viewSelf"], // Can only view their own employee record
  department: ["view"],
  location: ["view"],
});
