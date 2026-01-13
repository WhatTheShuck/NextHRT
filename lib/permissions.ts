import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  employee: ["view", "edit", "delete"],
  department: ["view", "edit", "manage", "viewAll"],
} as const;

export const ac = createAccessControl(statement);

// Define roles - this REPLACES your roleHierarchy object
export const adminRole = ac.newRole({
  ...adminAc.statements,
  employee: ["view", "edit", "delete"],
  department: ["view", "edit", "manage", "viewAll"],
});

export const departmentManagerRole = ac.newRole({
  employee: ["view", "edit"],
  department: ["view", "manage"],
});

export const fireWardenRole = ac.newRole({
  employee: ["view"],
  department: ["view"],
});

export const employeeViewerRole = ac.newRole({
  employee: ["view"],
  department: ["view"],
});

export const userRole = ac.newRole({
  employee: ["view"],
  department: ["view"],
});
