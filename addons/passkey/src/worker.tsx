import { Session } from "./session/durableObject";

export type AppContext = {
  session: Session | null;
};
