import type { PackageRuleItem } from "vibe-rules";
import { interruptors } from "./rules/interruptors.js";
import { middleware } from "./rules/middleware.js";
import { react } from "./rules/react.js";
import { requestResponse } from "./rules/request-response.js";

const rules: PackageRuleItem[] = [
  {
    name: "rwsdk-interruptors",
    description: "RedwoodSDK: Request Interruptors",
    rule: interruptors,
    alwaysApply: false,
    globs: ["worker.tsx", "src/app/**/routes.ts", "src/app/**/*/routes.ts"],
  },
  {
    name: "rwsdk-middleware",
    description: "RedwoodSDK: Middleware",
    rule: middleware,
    alwaysApply: true,
    globs: ["worker.tsx", "middleware.ts", "middleware.tsx"],
  },
  {
    name: "rwsdk-react",
    description:
      "RedwoodSDK: React, React Server Components, and React Server Functions Rules",
    rule: react,
    alwaysApply: false,
    globs: ["src/app/**/*/*.tsx", "Document.tsx"],
  },
  {
    name: "rwsdk-request-response",
    description: "RedwoodSDK: Request handling and responses",
    rule: requestResponse,
    alwaysApply: false,
    globs: ["worker.tsc", "src/app/**/routes.ts", "src/app/**/*/routes.ts"],
  },
];

export default rules;
