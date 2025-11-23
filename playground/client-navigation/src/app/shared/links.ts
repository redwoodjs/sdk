import { linkFor } from "rwsdk/router";

type App = typeof import("../../worker").default;

export const link = linkFor<App>();

// This should cause a TypeScript error because "/undefined-route" is not defined in the worker
export const undefinedRoute = link("/undefined-route");
