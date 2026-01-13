import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  employee: [
    "viewSelf",
    "viewDepartment",
    "viewAll",
    "edit",
    "create",
    "delete",
  ],
  department: ["create", "view", "edit", "manage", "viewAll"],
} as const;

export const ac = createAccessControl(statement);

export const adminRole = ac.newRole({
  ...adminAc.statements,
  employee: [
    "viewSelf",
    "viewDepartment",
    "viewAll",
    "edit",
    "create",
    "delete",
  ],
  department: ["view", "edit", "manage", "viewAll"],
});

export const departmentManagerRole = ac.newRole({
  employee: ["viewSelf", "viewDepartment", "edit"],
  department: ["view", "manage"],
});

export const fireWardenRole = ac.newRole({
  employee: ["viewSelf", "viewAll"], // Fire wardens need to all staff
  department: ["view"],
});

export const userRole = ac.newRole({
  employee: ["viewSelf"], // Can only view their own employee record
  department: ["view"],
});
