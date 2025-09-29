import { PasskeyDurableObject } from "./passkey/durableObject";
import { sessionStore } from "./session/store";
import { type AppContext } from "rwsdk/worker";

export const setup = (app: AppContext) => {
  app.use(async (c, next) => {
    c.set("session", await sessionStore.load(c.req.raw as unknown as Request));
    await next();
  });
};
