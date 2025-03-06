import { setupDb } from "./db";

export const setup = (env: Env) => {
  setupDb(env);
};
