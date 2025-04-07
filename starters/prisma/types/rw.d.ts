import { RequestContext } from "@redwoodjs/sdk/worker";
import { Data } from "@/worker";

declare module "@redwoodjs/sdk/worker" {
  export const requestContext: RequestContext & {
    data: Data;
  };
}
