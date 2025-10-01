import { afterEach, beforeEach } from "vitest";

const stubEnvVars = () => {
  let originals = {} as NodeJS.ProcessEnv;

  beforeEach(() => {
    originals = { ...process.env };
  });

  afterEach(() => {
    process.env = { ...originals };
  });
};

export default stubEnvVars;
