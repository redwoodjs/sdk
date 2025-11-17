import { linkFor } from "rwsdk/router";

type App = typeof import("../../worker").default;

export const link = linkFor<App>();
