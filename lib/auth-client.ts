import { createAuthClient } from "better-auth/react";
import { auth } from "./auth";
import { inferAdditionalFields, adminClient } from "better-auth/client/plugins";
import {
  ac,
  adminRole,
  departmentManagerRole,
  fireWardenRole,
  employeeViewerRole,
  userRole,
} from "@/lib/permissions";

export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields<typeof auth>(),
    adminClient({
      ac,
      roles: {
        Admin: adminRole,
        DepartmentManager: departmentManagerRole,
        FireWarden: fireWardenRole,
        EmployeeViewer: employeeViewerRole,
        User: userRole,
      },
    }),
  ],
});

export const { signIn, signOut, useSession } = authClient;
