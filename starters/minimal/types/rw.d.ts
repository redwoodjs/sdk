import { AppContext } from "../src/worker";

declare module "@redwoodjs/sdk/worker" {
  interface DefaultAppContext extends AppContext {}
}
