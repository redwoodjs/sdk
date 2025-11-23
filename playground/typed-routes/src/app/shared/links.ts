import { defineLinks } from "rwsdk/router";

type App = typeof import("../../worker").default;

// Test defineLinks with automatic route inference from app type
export const link = defineLinks<App>();
