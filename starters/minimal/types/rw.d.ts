import { RequestContext } from "@redwoodjs/sdk/worker";
import { Data, AppContext } from "@/worker";

declare module "@redwoodjs/sdk/worker" {
  export const requestContext: RequestContext & {
    data: Data;
  };

  export interface DefaultAppContext extends AppContext {}
}
