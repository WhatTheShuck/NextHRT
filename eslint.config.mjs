import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
    rules: {
      // "@typescript-eslint/no-explicit-any": "off",
      "use-role-hierarchy": {
        create: function (context) {
          return {
            BinaryExpression: function (node) {
              if (
                node.operator === "===" &&
                node.left.name === "userRole" &&
                node.right.type === "Literal"
              ) {
                context.report({
                  node,
                  message:
                    "Consider using hasRoleAccess() instead of direct role comparison",
                  suggest: [
                    {
                      desc: "Use hasRoleAccess function",
                      fix: function (fixer) {
                        return fixer.replaceText(
                          node,
                          `hasRoleAccess(userRole, ${node.right.raw})`,
                        );
                      },
                    },
                  ],
                });
              }
            },
          };
        },
      },
    },
  }),
];

export default eslintConfig;
